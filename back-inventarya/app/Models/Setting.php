<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

    protected $fillable = [
        'business_name',
        'logo',
        'favicon',
        'email',
        'phone',
        'address',
        'theme',
        'primary_color',
        'terms',
        'policy',
        'currency',
        'timezone',
        'social',
        'enable_customers',
        'enable_suppliers',
        'enable_locations',
        'electronic_invoicing_enabled',
        'tax_nit',
        'tax_business_name',
        'siat_environment',
        'siat_modality',
        'siat_system_code',
        'siat_api_token',
        'siat_certificate_path',
        'siat_certificate_password',
    ];

    protected $casts = [
        'social' => 'array',
        'enable_customers' => 'boolean',
        'enable_suppliers' => 'boolean',
        'enable_locations' => 'boolean',
        'electronic_invoicing_enabled' => 'boolean',
        'siat_environment' => 'integer',
        'siat_modality' => 'integer',
        'siat_api_token' => 'encrypted',
        'siat_certificate_password' => 'encrypted',
    ];

    /**
     * Sensitve SIAT credentials are never exposed in serialized JSON / API responses.
     */
    protected $hidden = [
        'siat_api_token',
        'siat_certificate_password',
    ];

    protected $appends = [
        'siat_token_configured',
        'siat_certificate_password_configured',
        'electronic_invoicing_status',
    ];

    /**
     * Estado derivado local de facturación electrónica:
     * - 'disabled'   => Facturación apagada a nivel global
     * - 'incomplete' => Activada pero faltan datos fiscales requeridos localmente
     * - 'configured' => Activada y con todos los datos locales requeridos completos
     */
    public function getElectronicInvoicingStatusAttribute(): string
    {
        if (!$this->electronic_invoicing_enabled) {
            return 'disabled';
        }

        $hasRequiredFields = !empty($this->tax_nit)
            && !empty($this->tax_business_name)
            && !empty($this->siat_environment)
            && !empty($this->siat_modality)
            && !empty($this->siat_system_code)
            && !empty($this->attributes['siat_api_token']);

        return $hasRequiredFields ? 'configured' : 'incomplete';
    }

    public function getSiatTokenConfiguredAttribute(): bool
    {
        return !empty($this->attributes['siat_api_token']);
    }

    public function getSiatCertificatePasswordConfiguredAttribute(): bool
    {
        return !empty($this->attributes['siat_certificate_password']);
    }

    public function getLogoAttribute($value): ?string
    {
        if (empty($value) || $value === '/logo.png' || $value === 'logo.png') {
            return null;
        }
        if (str_starts_with($value, 'data:') || str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }
        return \App\Services\FileStorageService::getPublicUrl($value);
    }

    public function getFaviconAttribute($value): ?string
    {
        if (empty($value)) {
            return null;
        }
        if (str_starts_with($value, 'data:') || str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return $value;
        }
        return \App\Services\FileStorageService::getPublicUrl($value);
    }
}
