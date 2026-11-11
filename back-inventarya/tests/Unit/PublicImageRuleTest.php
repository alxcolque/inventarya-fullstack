<?php

namespace Tests\Unit;

use App\Rules\PublicImage;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class PublicImageRuleTest extends TestCase
{
    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    public function test_valid_png_base64_is_accepted(): void
    {
        $validator = Validator::make(['image' => self::PNG], [
            'image' => [new PublicImage(2048, false, false)],
        ]);

        $this->assertFalse($validator->fails(), $validator->errors()->first('image'));
    }

    public function test_corrupt_base64_is_rejected(): void
    {
        $validator = Validator::make(['image' => 'data:image/png;base64,broken'], [
            'image' => [new PublicImage(2048, false, false)],
        ]);

        $this->assertTrue($validator->fails());
    }

    public function test_svg_is_rejected_without_a_sanitizer(): void
    {
        $svg = 'data:image/svg+xml;base64,'.base64_encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        $validator = Validator::make(['image' => $svg], [
            'image' => [new PublicImage(2048, false, false)],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertStringContainsString('SVG', $validator->errors()->first('image'));
    }

    public function test_oversized_payload_is_rejected(): void
    {
        $payload = 'data:image/png;base64,'.base64_encode(str_repeat('x', 2049 * 1024));
        $validator = Validator::make(['image' => $payload], [
            'image' => [new PublicImage(2048, false, false)],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertStringContainsString('tamaño', $validator->errors()->first('image'));
    }

    public function test_declared_mime_mismatch_is_rejected(): void
    {
        $jpegLabelledPng = str_replace('data:image/png;', 'data:image/jpeg;', self::PNG);
        $validator = Validator::make(['image' => $jpegLabelledPng], [
            'image' => [new PublicImage(2048, false, false)],
        ]);

        $this->assertTrue($validator->fails());
        $this->assertStringContainsString('tipo declarado', $validator->errors()->first('image'));
    }

    public function test_managed_cdn_reference_is_allowed_for_legacy_updates(): void
    {
        config(['filesystems.disks.r2.url' => 'https://cdn.inventarya.com']);

        $validator = Validator::make([
            'image' => 'https://cdn.inventarya.com/tenant/acme/products/old.webp',
        ], [
            'image' => [new PublicImage(2048)],
        ]);

        $this->assertFalse($validator->fails(), $validator->errors()->first('image'));
    }
}
