<?php

namespace Tests\Unit;

use App\Models\Brand;
use App\Models\CentralUser;
use App\Models\Configuration;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Setting;
use App\Models\Store;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaModelUrlTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'filesystems.media_disk' => 'r2',
            'filesystems.disks.r2.url' => 'https://cdn.inventarya.com',
        ]);
        Storage::fake('r2', ['url' => 'https://cdn.inventarya.com']);
        Storage::fake('public');
    }

    public function test_media_models_persist_paths_and_expose_filesystem_urls(): void
    {
        $path = 'tenant/acme/products/image.webp';
        Storage::disk('r2')->put($path, 'image');

        $models = [
            [new Product(['image' => $path]), 'image'],
            [new ProductImage(['image' => $path, 'image_key' => $path]), 'image'],
            [new Brand(['image' => $path, 'image_key' => $path]), 'image'],
            [new Store(['front_image' => $path, 'front_image_key' => $path]), 'front_image'],
            [new User(['avatar' => $path, 'avatar_key' => $path]), 'avatar'],
            [new CentralUser(['avatar' => $path]), 'avatar'],
            [new Setting(['logo' => $path]), 'logo'],
            [new Configuration(['logo' => $path]), 'logo'],
        ];

        foreach ($models as [$model, $attribute]) {
            $this->assertSame($path, $model->getAttributes()[$attribute]);
            $this->assertSame('https://cdn.inventarya.com/'.$path, $model->{$attribute});
        }
    }

    public function test_old_absolute_urls_and_data_uris_remain_compatible(): void
    {
        $cdn = 'https://cdn.inventarya.com/tenant/acme/products/old.webp';
        $external = 'https://images.example.com/logo.png';
        $data = 'data:image/png;base64,abc';

        $this->assertSame($cdn, (new Product(['image' => $cdn]))->image);
        $this->assertSame($external, (new Configuration(['logo' => $external]))->logo);
        $this->assertSame($data, (new Setting(['logo' => $data]))->logo);
    }
}
