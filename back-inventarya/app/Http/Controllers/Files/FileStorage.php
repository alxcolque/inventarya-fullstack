<?php

namespace App\Http\Controllers\Files;

use App\Http\Controllers\Controller;
use App\Services\FileStorageService;
use Illuminate\Support\Facades\Log;

class FileStorage extends Controller
{
    /**
     * Sube un archivo o imagen (UploadedFile, Base64 o binario),
     * lo optimiza y convierte a formato WebP comprimido sin perder calidad visual,
     * y lo guarda en el Storage público del sistema/tenant.
     *
     * Retorna el formato "{storage_key},{public_url}" requerido por los controladores,
     * o "Error33" en caso de falla.
     *
     * @param  mixed  $file  Archivo a subir (UploadedFile|string base64|path)
     * @param  string  $folder  Carpeta destino en storage (ej: 'inventory/stores', 'brands', etc.)
     */
    public static function upload(mixed $file, string $folder = 'uploads'): string
    {
        if (empty($file) || $file === 'null' || $file === 'undefined') {
            return 'Error33';
        }

        try {
            $result = FileStorageService::upload($file, $folder);

            return $result['combo'];
        } catch (\Throwable $e) {
            Log::error('Error en FileStorage::upload', [
                'folder' => $folder,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return 'Error33';
        }
    }

    /**
     * Elimina un archivo del storage a partir de su URL pública o su llave de almacenamiento.
     *
     * @param  string|null  $path  URL pública o ruta relativa
     * @param  string|null  $key  Llave en storage_disk
     */
    public static function delete(?string $path, ?string $key = null): bool
    {
        try {
            return FileStorageService::delete($path, $key);
        } catch (\Throwable $e) {
            Log::error('Error en FileStorage::delete', [
                'path' => $path,
                'key' => $key,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Reemplaza una imagen antigua por una nueva en el storage.
     */
    public static function replace(mixed $newFile, string $folder = 'uploads', ?string $oldPath = null, ?string $oldKey = null): string
    {
        try {
            $result = FileStorageService::replace($oldKey ?: $oldPath, $newFile, null, $folder);

            return $result['combo'];
        } catch (\Throwable $exception) {
            Log::error('Error en FileStorage::replace', ['error' => $exception->getMessage()]);

            return 'Error33';
        }
    }
}
