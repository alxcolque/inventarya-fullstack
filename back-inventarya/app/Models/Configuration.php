<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Configuration extends Model
{
    use HasFactory;

    protected $fillable = [
        'logo',
        'favicon',
        'name',
        'description',
        'phone',
        'email',
        'privacy',
        'terms',
        'about_us',
    ];

    /**
     * Get or create current configuration singleton.
     */
    public static function current(): self
    {
        return static::firstOrCreate([], [
            'name' => 'Inventarya',
            'description' => 'Sistema integral de gestión de inventarios, almacenes y punto de venta multi-sucursal.',
            'phone' => '+591 70000000',
            'email' => 'contacto@inventarya.com',
            'privacy' => 'Nuestra política de privacidad protege rigurosamente la información comercial de nuestros clientes...',
            'terms' => 'Términos y condiciones de uso del servicio SaaS Inventarya...',
            'about_us' => 'Inventarya es una solución cloud diseñada para optimizar el control de stock, acelerar ventas en sucursales y brindar analítica precisa.',
        ]);
    }

    public function getLogoAttribute($value): ?string
    {
        if (empty($value)) return null;
        if (str_starts_with($value, 'data:') || str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }
        return \App\Services\FileStorageService::getPublicUrl($value);
    }

    public function getFaviconAttribute($value): ?string
    {
        if (empty($value)) return null;
        if (str_starts_with($value, 'data:') || str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }
        return \App\Services\FileStorageService::getPublicUrl($value);
    }
}
