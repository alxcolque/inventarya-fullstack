<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class FileStorageService
{
    public const DEFAULT_WEBP_QUALITY = 82;

    public const MAX_WIDTH = 1920;

    public const MAX_HEIGHT = 1920;

    public const MAX_UPLOAD_BYTES = 10485760;

    private const MIME_EXTENSIONS = [
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/png' => ['png'],
        'image/webp' => ['webp'],
    ];

    public static function mediaDiskName(): string
    {
        return (string) config('filesystems.media_disk', config('filesystems.default', 'local'));
    }

    public static function disk(): \Illuminate\Contracts\Filesystem\Filesystem
    {
        return Storage::disk(self::mediaDiskName());
    }

    public static function upload(
        mixed $file,
        string $folder = 'uploads',
        ?string $tenant = null,
        int $quality = self::DEFAULT_WEBP_QUALITY,
        int $maxWidth = self::MAX_WIDTH,
        int $maxHeight = self::MAX_HEIGHT
    ): array {
        if (empty($file)) {
            throw new \InvalidArgumentException('No se ha proporcionado ningún archivo para subir.');
        }

        if (is_string($file) && ! str_starts_with($file, 'data:image/')) {
            if (self::isManagedReference($file)) {
                $key = self::normalizePath($file);
                if ($key === null) {
                    throw new \InvalidArgumentException('La referencia de imagen no es válida.');
                }

                return self::existingResult($key);
            }

            if (filter_var($file, FILTER_VALIDATE_URL)) {
                throw new \InvalidArgumentException('Las URLs externas no se procesan como archivos nuevos.');
            }
        }

        if ($error = self::imageValidationError($file)) {
            throw new \InvalidArgumentException($error);
        }

        $image = Image::read(self::imageBinary($file))->scaleDown($maxWidth, $maxHeight);
        $encoded = $image->toWebp($quality);
        $tenantId = $tenant;

        if ($tenantId === null && function_exists('tenant') && tenant('id')) {
            $tenantId = (string) tenant('id');
        }

        $cleanFolder = trim($folder, '/');
        if (str_starts_with($cleanFolder, 'inventory/')) {
            $cleanFolder = substr($cleanFolder, strlen('inventory/'));
        }

        $base = $tenantId ? "tenant/{$tenantId}/{$cleanFolder}" : $cleanFolder;
        $path = $base.'/'.Str::uuid().'.webp';
        $disk = self::disk();

        if ($disk->put($path, (string) $encoded) === false) {
            throw new \RuntimeException('No se pudo guardar la imagen.');
        }

        $url = self::getPublicUrl($path);

        return [
            'key' => $path,
            'path' => $path,
            'url' => $url,
            'combo' => $path.','.$url,
            'size' => $disk->size($path),
            'mime' => 'image/webp',
            'width' => $image->width(),
            'height' => $image->height(),
        ];
    }

    public static function uploadBase64(string $base64, string $tenant, string $folder = 'products'): array
    {
        if ($error = self::imageValidationError($base64)) {
            throw new \InvalidArgumentException($error);
        }

        $image = Image::read(self::imageBinary($base64));
        $name = Str::uuid().'.webp';
        $folder = preg_replace('#^inventory/#', '', trim($folder, '/'));
        $base = "tenant/{$tenant}/{$folder}";
        $paths = [
            'path' => "{$base}/original/{$name}",
            'medium' => "{$base}/medium/{$name}",
            'thumbnail' => "{$base}/thumb/{$name}",
        ];
        $disk = self::disk();
        $writes = [
            $paths['path'] => (string) $image->scaleDown(1600, 1600)->toWebp(82),
            $paths['medium'] => (string) $image->cover(600, 600)->toWebp(78),
            $paths['thumbnail'] => (string) $image->cover(200, 200)->toWebp(72),
        ];

        try {
            foreach ($writes as $path => $contents) {
                if ($disk->put($path, $contents) === false) {
                    throw new \RuntimeException('No se pudieron guardar las variantes.');
                }
            }
        } catch (\Throwable $exception) {
            foreach (array_keys($writes) as $path) {
                if ($disk->exists($path)) {
                    $disk->delete($path);
                }
            }
            throw $exception;
        }

        return $paths + [
            'url' => self::getPublicUrl($paths['path']),
            'size' => $disk->size($paths['path']),
            'mime' => 'image/webp',
        ];
    }

    public static function delete(?string $path, ?string $key = null): bool
    {
        $deleted = false;

        foreach (array_unique(array_filter([$key, $path])) as $target) {
            $clean = self::normalizePath($target);
            if ($clean === null) {
                continue;
            }

            foreach (array_unique([self::mediaDiskName(), 'public']) as $diskName) {
                try {
                    $disk = Storage::disk($diskName);
                    if ($disk->exists($clean) && $disk->delete($clean)) {
                        $deleted = true;
                    }
                } catch (\Throwable $exception) {
                    Log::warning("No se pudo eliminar '{$clean}' del disco '{$diskName}': ".$exception->getMessage());
                }
            }
        }

        return $deleted;
    }

    public static function replace(
        ?string $oldPath,
        mixed $newFile,
        ?string $tenant = null,
        string $folder = 'uploads'
    ): array {
        $upload = self::upload($newFile, $folder, $tenant);

        if ($oldPath && ! self::referencesMatch($oldPath, $upload['path'])) {
            self::delete($oldPath);
        }

        return $upload;
    }

    public static function getPublicUrl(?string $path): string
    {
        if (empty($path) || str_starts_with($path, 'data:')) {
            return $path ?? '';
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            $host = strtolower((string) parse_url($path, PHP_URL_HOST));
            if (! in_array($host, ['localhost', '127.0.0.1'], true)) {
                return $path;
            }
        }

        $clean = self::normalizePath($path);
        if ($clean === null) {
            return $path;
        }

        $media = self::disk();

        try {
            if ($media->exists($clean)) {
                return $media->url($clean);
            }
        } catch (\Throwable) {
        }

        if (self::mediaDiskName() !== 'public') {
            try {
                $legacy = Storage::disk('public');
                if ($legacy->exists($clean)) {
                    return $legacy->url($clean);
                }
            } catch (\Throwable) {
            }
        }

        return $media->url($clean);
    }

    public static function isManagedReference(?string $reference): bool
    {
        if (empty($reference) || str_starts_with($reference, 'data:')) {
            return false;
        }

        if (! filter_var($reference, FILTER_VALIDATE_URL)) {
            $candidate = ltrim($reference, '/');

            return str_starts_with($candidate, 'storage/')
                || (str_contains($candidate, '/') && preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]*$#', $candidate));
        }

        if (str_starts_with((string) parse_url($reference, PHP_URL_PATH), '/storage/')) {
            return true;
        }

        foreach (self::managedBaseUrls() as $base) {
            if (self::urlStartsWith($reference, $base)) {
                return true;
            }
        }

        return false;
    }

    public static function isNewUpload(mixed $value): bool
    {
        return $value instanceof UploadedFile
            || (is_string($value) && str_starts_with($value, 'data:image/'));
    }

    public static function referencesMatch(?string $left, ?string $right): bool
    {
        if ($left === $right) {
            return true;
        }

        $left = self::normalizePath($left);
        $right = self::normalizePath($right);

        return $left !== null && $right !== null && $left === $right;
    }

    public static function normalizePath(?string $path): ?string
    {
        if (empty($path) || str_starts_with($path, 'data:')) {
            return null;
        }

        if (! filter_var($path, FILTER_VALIDATE_URL)) {
            $clean = ltrim((string) preg_replace('#^/?storage/#', '', $path), '/');

            return preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]*$#', $clean) ? $clean : null;
        }

        $urlPath = (string) parse_url($path, PHP_URL_PATH);
        if (preg_match('#^/storage/(.+)$#', $urlPath, $match)) {
            return ltrim($match[1], '/');
        }

        foreach (self::managedBaseUrls() as $base) {
            if (! self::urlStartsWith($path, $base)) {
                continue;
            }

            $basePath = trim((string) parse_url($base, PHP_URL_PATH), '/');
            $clean = trim($urlPath, '/');

            if ($basePath !== '' && str_starts_with($clean, $basePath.'/')) {
                $clean = substr($clean, strlen($basePath) + 1);
            }

            return $clean !== '' && $clean !== $basePath ? $clean : null;
        }

        return null;
    }

    public static function cleanStoragePath(?string $path): ?string
    {
        return self::normalizePath($path);
    }

    public static function imageValidationError(
        mixed $file,
        int $maxBytes = self::MAX_UPLOAD_BYTES,
        bool $allowManagedReference = true,
        bool $allowExternalUrl = true,
        bool $allowDeleteSentinel = false
    ): ?string {
        if ($file === null || $file === '' || ($allowDeleteSentinel && $file === 'delete')) {
            return null;
        }

        if (is_string($file) && ! str_starts_with($file, 'data:image/')) {
            if ($allowManagedReference && self::isManagedReference($file)) {
                return null;
            }

            if ($allowExternalUrl && filter_var($file, FILTER_VALIDATE_URL)) {
                return in_array(strtolower((string) parse_url($file, PHP_URL_SCHEME)), ['http', 'https'], true)
                    ? null
                    : 'La URL de la imagen no es válida.';
            }

            return 'La imagen debe enviarse como archivo, base64 o referencia válida.';
        }

        try {
            $binary = self::imageBinary($file);
        } catch (\Throwable $exception) {
            return $exception->getMessage();
        }

        if (strlen($binary) > $maxBytes) {
            return 'La imagen supera el tamaño máximo permitido.';
        }

        $info = @getimagesizefromstring($binary);
        $mime = is_array($info) ? ($info['mime'] ?? null) : null;

        if (! is_string($mime) || ! isset(self::MIME_EXTENSIONS[$mime])) {
            return 'La imagen debe ser JPG, PNG o WebP. SVG no está permitido.';
        }

        if ($file instanceof UploadedFile
            && ! in_array(strtolower($file->getClientOriginalExtension()), self::MIME_EXTENSIONS[$mime], true)) {
            return 'La extensión del archivo no coincide con su contenido.';
        }

        if (is_string($file) && preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $file, $match)) {
            $declared = strtolower($match[1]) === 'jpg' ? 'jpeg' : strtolower($match[1]);
            if ($declared !== substr($mime, 6)) {
                return 'El tipo declarado de la imagen no coincide con su contenido.';
            }
        }

        try {
            Image::read($binary);
        } catch (\Throwable) {
            return 'La imagen está corrupta o no se puede procesar.';
        }

        return null;
    }

    protected static function imageBinary(mixed $file): string
    {
        if ($file instanceof UploadedFile) {
            if (! $file->isValid()) {
                throw new \InvalidArgumentException('La carga del archivo no se completó correctamente.');
            }

            $contents = @file_get_contents($file->getRealPath());
            if ($contents === false) {
                throw new \InvalidArgumentException('No se pudo leer el archivo subido.');
            }

            return $contents;
        }

        if (is_string($file) && preg_match('#^data:image/[a-zA-Z0-9.+-]+;base64,#', $file)) {
            $decoded = base64_decode(substr($file, strpos($file, ',') + 1), true);
            if ($decoded === false || $decoded === '') {
                throw new \InvalidArgumentException('El contenido base64 de la imagen no es válido.');
            }

            return $decoded;
        }

        throw new \InvalidArgumentException('El formato de entrada de la imagen no es compatible.');
    }

    protected static function existingResult(string $key): array
    {
        $size = null;

        foreach (array_unique([self::mediaDiskName(), 'public']) as $diskName) {
            try {
                $disk = Storage::disk($diskName);
                if ($disk->exists($key)) {
                    $size = $disk->size($key);
                    break;
                }
            } catch (\Throwable) {
            }
        }

        $url = self::getPublicUrl($key);

        return [
            'key' => $key,
            'path' => $key,
            'url' => $url,
            'combo' => $key.','.$url,
            'size' => $size,
            'mime' => 'image/webp',
            'width' => null,
            'height' => null,
        ];
    }

    protected static function managedBaseUrls(): array
    {
        $urls = [];

        foreach (array_unique([self::mediaDiskName(), 'local', 'public', 'r2']) as $disk) {
            $url = config("filesystems.disks.{$disk}.url");
            if (is_string($url) && $url !== '') {
                $urls[] = rtrim($url, '/');
            }
        }

        return array_values(array_unique($urls));
    }

    protected static function urlStartsWith(string $url, string $base): bool
    {
        $urlParts = parse_url($url);
        $baseParts = parse_url($base);

        if (! is_array($urlParts) || ! is_array($baseParts)
            || strtolower((string) ($urlParts['scheme'] ?? '')) !== strtolower((string) ($baseParts['scheme'] ?? ''))
            || strtolower((string) ($urlParts['host'] ?? '')) !== strtolower((string) ($baseParts['host'] ?? ''))
            || ($urlParts['port'] ?? null) !== ($baseParts['port'] ?? null)) {
            return false;
        }

        $urlPath = '/'.ltrim((string) ($urlParts['path'] ?? ''), '/');
        $basePath = rtrim('/'.ltrim((string) ($baseParts['path'] ?? ''), '/'), '/');

        return $basePath === '' || $urlPath === $basePath || str_starts_with($urlPath, $basePath.'/');
    }
}
