<?php

namespace Tests\Unit;

use App\Services\FileStorageService;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class FileStorageServiceTest extends TestCase
{
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'filesystems.default' => 'local',
            'filesystems.media_disk' => 'local',
            'filesystems.disks.local.url' => 'http://localhost:8000/storage',
            'filesystems.disks.public.url' => 'http://localhost:8000/storage',
            'filesystems.disks.r2.url' => 'https://cdn.inventarya.com',
        ]);

        Storage::fake('local');
        Storage::fake('public');
    }

    public function test_local_media_upload_returns_and_stores_a_relative_path(): void
    {
        $upload = FileStorageService::upload(self::PNG, 'products', 'tenant-a');

        $this->assertMatchesRegularExpression(
            '#^tenant/tenant-a/products/[0-9a-f-]+\.webp$#',
            $upload['path']
        );
        $this->assertSame($upload['path'], $upload['key']);
        $this->assertStringContainsString('/storage/'.$upload['path'], $upload['url']);
        Storage::disk('local')->assertExists($upload['path']);
    }

    public function test_r2_media_disk_is_selected_without_using_the_default_disk(): void
    {
        config(['filesystems.media_disk' => 'r2']);
        Storage::fake('r2', ['url' => 'https://cdn.inventarya.com']);

        $upload = FileStorageService::upload(self::PNG, 'products', 'tenant-r2');

        Storage::disk('r2')->assertExists($upload['path']);
        Storage::disk('local')->assertMissing($upload['path']);
        $this->assertStringStartsWith('https://cdn.inventarya.com/', $upload['url']);
    }

    public function test_public_media_modules_keep_their_expected_prefixes(): void
    {
        $cases = [
            ['products', 'tenant/t1/products/'],
            ['products/gallery', 'tenant/t1/products/gallery/'],
            ['inventory/brands', 'tenant/t1/brands/'],
            ['inventory/stores', 'tenant/t1/stores/'],
            ['inventory/users', 'tenant/t1/users/'],
        ];

        foreach ($cases as [$folder, $prefix]) {
            $upload = FileStorageService::upload(self::PNG, $folder, 't1');
            $this->assertStringStartsWith($prefix, $upload['path']);
        }

        $this->assertStringStartsWith(
            'central/users/',
            FileStorageService::upload(self::PNG, 'central/users')['path']
        );
        $this->assertStringStartsWith(
            'configurations/',
            FileStorageService::upload(self::PNG, 'configurations')['path']
        );
    }

    public function test_tenant_paths_are_isolated(): void
    {
        $first = FileStorageService::upload(self::PNG, 'products', 'tenant-a');
        $second = FileStorageService::upload(self::PNG, 'products', 'tenant-b');

        $this->assertStringStartsWith('tenant/tenant-a/', $first['path']);
        $this->assertStringStartsWith('tenant/tenant-b/', $second['path']);
        $this->assertNotSame($first['path'], $second['path']);
    }

    public function test_legacy_and_cdn_references_are_normalized_without_reuploading(): void
    {
        config(['filesystems.media_disk' => 'r2']);
        Storage::fake('r2', ['url' => 'https://cdn.inventarya.com']);
        $path = 'tenant/acme/products/item.webp';
        Storage::disk('r2')->put($path, 'existing');

        $this->assertSame($path, FileStorageService::normalizePath('/storage/'.$path));
        $this->assertSame($path, FileStorageService::normalizePath('https://api.inventarya.com/storage/'.$path));
        $this->assertSame($path, FileStorageService::normalizePath('https://cdn.inventarya.com/'.$path));

        $existing = FileStorageService::upload('https://cdn.inventarya.com/'.$path);
        $this->assertSame($path, $existing['path']);
        $this->assertSame('existing', Storage::disk('r2')->get($path));
    }

    public function test_external_urls_remain_readable_but_are_never_deleted_as_media(): void
    {
        $url = 'https://images.example.com/logo.png';

        $this->assertSame($url, FileStorageService::getPublicUrl($url));
        $this->assertNull(FileStorageService::normalizePath($url));
        $this->assertFalse(FileStorageService::delete($url));
    }

    public function test_delete_removes_media_from_the_selected_disk(): void
    {
        $path = 'tenant/acme/products/delete.webp';
        Storage::disk('local')->put($path, 'image');

        $this->assertTrue(FileStorageService::delete($path));
        Storage::disk('local')->assertMissing($path);
    }

    public function test_failed_replacement_preserves_the_previous_file(): void
    {
        $old = 'tenant/acme/products/old.webp';
        Storage::disk('local')->put($old, 'old-image');

        try {
            FileStorageService::replace($old, 'data:image/png;base64,not-valid-base64', 'acme', 'products');
            $this->fail('The invalid image should have failed.');
        } catch (\InvalidArgumentException) {
            Storage::disk('local')->assertExists($old);
            $this->assertSame('old-image', Storage::disk('local')->get($old));
        }
    }
}
