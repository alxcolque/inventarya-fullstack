<?php

namespace Tests\Unit\Support;

use App\Support\DomainNormalizer;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class DomainNormalizerTest extends TestCase
{
    #[DataProvider('validDomains')]
    public function test_it_normalizes_supported_domain_inputs(string $input, string $expected): void
    {
        $this->assertSame($expected, DomainNormalizer::normalize($input));
    }

    public static function validDomains(): array
    {
        return [
            'uppercase' => ['EMPRESA.INVENTARYA.COM', 'empresa.inventarya.com'],
            'scheme' => ['https://empresa.inventarya.com', 'empresa.inventarya.com'],
            'trailing slash' => ['empresa.inventarya.com/', 'empresa.inventarya.com'],
            'port' => ['empresa.inventarya.com:443', 'empresa.inventarya.com'],
            'final dns dot' => ['empresa.inventarya.com.', 'empresa.inventarya.com'],
            'localhost' => ['ALICIA.LOCALHOST:5173', 'alicia.localhost'],
        ];
    }

    #[DataProvider('invalidDomains')]
    public function test_it_rejects_values_that_are_not_plain_hostnames(string $input): void
    {
        $this->expectException(InvalidArgumentException::class);

        DomainNormalizer::normalize($input);
    }

    public static function invalidDomains(): array
    {
        return [
            'path' => ['empresa.inventarya.com/admin'],
            'query' => ['empresa.inventarya.com?tenant=otro'],
            'fragment' => ['empresa.inventarya.com#fragment'],
            'credentials' => ['https://user:password@empresa.inventarya.com'],
            'wildcard' => ['*.inventarya.com'],
            'invalid label' => ['-empresa.inventarya.com'],
        ];
    }
}
