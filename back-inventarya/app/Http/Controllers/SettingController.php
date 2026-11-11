<?php

namespace App\Http\Controllers;

use App\Enums\SiatEnvironment;
use App\Enums\SiatModality;
use App\Models\Setting;
use App\Rules\PublicImage;
use App\Services\FileStorageService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class SettingController extends Controller
{
    /**
     * Get or initialize the primary settings for the current tenant.
     */
    protected function getOrCreateSetting(): Setting
    {
        $this->ensureSettingColumnsExist();
        $setting = Setting::first();
        $currentTenant = tenancy()->initialized ? tenant() : null;
        $tenantName = $currentTenant?->name;
        $tenantLogo = $currentTenant?->logo;
        if ($tenantLogo === '/logo.png' || $tenantLogo === 'logo.png') {
            $tenantLogo = null;
        }
        $tenantEmail = $currentTenant?->owner_email;
        $tenantPhone = $currentTenant?->owner_phone;

        if (!$setting) {
            $setting = Setting::create([
                'business_name' => $tenantName ?: 'Inventarya Sucursal',
                'logo'          => $tenantLogo ?: null,
                'email'         => $tenantEmail,
                'phone'         => $tenantPhone,
                'currency'      => 'BOB',
                'timezone'      => 'America/La_Paz',
                'theme'         => 'light',
                'enable_customers' => false,
                'enable_suppliers' => false,
                'enable_locations' => false,
                'social'        => [
                    'facebook'  => '',
                    'instagram' => '',
                    'tiktok'    => '',
                    'whatsapp'  => $tenantPhone ?? '',
                ],
            ]);
        } else {
            $updates = [];
            if ($tenantName && ($setting->business_name === 'Inventarya Sucursal' || empty($setting->business_name))) {
                $updates['business_name'] = $tenantName;
            }
            $rawLogo = $setting->getRawOriginal('logo');
            if ($rawLogo === '/logo.png' || $rawLogo === 'logo.png') {
                $updates['logo'] = null;
            }
            if (!empty($updates)) {
                $setting->update($updates);
            }
        }

        return $setting;
    }

    /**
     * Public system data endpoint (for headers, login screen, branding).
     */
    public function getSystemData()
    {
        $setting = $this->getOrCreateSetting();
        $currentTenant = tenancy()->initialized ? tenant() : null;

        $primaryDomain = null;
        if ($currentTenant) {
            $primaryDomain = $currentTenant->domains->first()?->domain
                ?? request()->header('X-Tenant-Domain')
                ?? request()->getHost();
        }

        $realName = null;
        if ($setting->business_name && $setting->business_name !== 'Inventarya Sucursal') {
            $realName = $setting->business_name;
        } elseif ($currentTenant?->name && $currentTenant->name !== 'Inventarya Sucursal') {
            $realName = $currentTenant->name;
        } else {
            $realName = $setting->business_name ?: ($currentTenant?->name ?? 'Inventarya Sucursal');
        }

        $logoUrl = $setting->logo;
        if (empty($logoUrl) && $currentTenant && !empty($currentTenant->logo)) {
            $rawTenantLogo = $currentTenant->logo;
            if ($rawTenantLogo !== '/logo.png' && $rawTenantLogo !== 'logo.png') {
                $logoUrl = str_starts_with($rawTenantLogo, 'http://') || str_starts_with($rawTenantLogo, 'https://') || str_starts_with($rawTenantLogo, 'data:')
                    ? $rawTenantLogo
                    : \App\Services\FileStorageService::getPublicUrl($rawTenantLogo);
            }
        }
        if ($logoUrl === '/logo.png' || $logoUrl === 'logo.png') {
            $logoUrl = null;
        }

        return response()->json([
            'setting' => $setting,
            'tenant' => $currentTenant ? [
                'id' => (string) $currentTenant->id,
                'name' => $currentTenant->name,
                'slug' => $currentTenant->slug,
                'domain' => $primaryDomain,
            ] : null,
            'branding' => [
                'name' => $realName,
                'business_name' => $realName,
                'logo' => $logoUrl ?: null,
                'favicon' => $setting->favicon ?: null,
                'primary_color' => $setting->primary_color,
                'theme' => $setting->theme,
            ],
        ], 200);
    }

    /**
     * Get current tenant settings.
     */
    public function index()
    {
        $setting = $this->getOrCreateSetting();

        return response()->json($setting);
    }

    /**
     * Show setting by ID or fallback to current setting.
     */
    public function show($id = null)
    {
        $setting = $id ? (Setting::find($id) ?? $this->getOrCreateSetting()) : $this->getOrCreateSetting();

        return response()->json($setting);
    }

    /**
     * Update tenant settings.
     */
    public function update(Request $request, $id = null)
    {
        $this->ensureSettingColumnsExist();
        $setting = $id ? (Setting::find($id) ?? $this->getOrCreateSetting()) : $this->getOrCreateSetting();
        $oldLogo = $setting->getRawOriginal('logo');
        $oldFavicon = $setting->getRawOriginal('favicon');
        $newPaths = [];

        $isInvoicingEnabled = $request->has('electronic_invoicing_enabled')
            ? $request->boolean('electronic_invoicing_enabled')
            : (bool) $setting->electronic_invoicing_enabled;

        $validated = $request->validate([
            'business_name' => 'sometimes|required|string|max:150',
            'email'         => 'nullable|email|max:150',
            'phone'         => 'nullable|string|max:50',
            'address'       => 'nullable|string|max:500',
            'theme'         => 'nullable|string|in:light,dark',
            'primary_color' => 'nullable|string|max:30',
            'terms'         => 'nullable|string',
            'policy'        => 'nullable|string',
            'currency'      => 'nullable|string|max:10',
            'timezone'      => 'nullable|string|max:50',
            'enable_customers' => 'nullable|boolean',
            'enable_suppliers' => 'nullable|boolean',
            'enable_locations' => 'nullable|boolean',
            'electronic_invoicing_enabled' => 'nullable|boolean',
            'tax_nit'         => [$isInvoicingEnabled && $request->has('tax_nit') ? 'required' : 'nullable', 'string', 'max:30'],
            'tax_business_name' => [$isInvoicingEnabled && $request->has('tax_business_name') ? 'required' : 'nullable', 'string', 'max:200'],
            'siat_environment' => ['nullable', 'integer', Rule::in(SiatEnvironment::values())],
            'siat_modality'    => ['nullable', 'integer', Rule::in(SiatModality::values())],
            'siat_system_code' => [$isInvoicingEnabled && $request->has('siat_system_code') ? 'required' : 'nullable', 'string', 'max:100'],
            'siat_api_token'   => 'nullable|string',
            'siat_certificate_path' => 'nullable|string|max:255',
            'siat_certificate_password' => 'nullable|string',
            'social' => 'nullable',
            'logo' => 'nullable|string',
            'favicon' => 'nullable|string',
            'logo_file' => ['nullable', new PublicImage(2048, false, false)],
            'favicon_file' => ['nullable', new PublicImage(1024, false, false)],
        ]);
        unset($validated['logo_file'], $validated['favicon_file']);

        // Evitar sobreescribir secretos SIAT si no fueron enviados o vienen vacíos o con máscara
        if (!array_key_exists('siat_api_token', $validated)
            || $validated['siat_api_token'] === null
            || trim((string)$validated['siat_api_token']) === ''
            || preg_match('/^\*+$/', trim((string)$validated['siat_api_token']))) {
            unset($validated['siat_api_token']);
        }
        if (!array_key_exists('siat_certificate_password', $validated)
            || $validated['siat_certificate_password'] === null
            || trim((string)$validated['siat_certificate_password']) === ''
            || preg_match('/^\*+$/', trim((string)$validated['siat_certificate_password']))) {
            unset($validated['siat_certificate_password']);
        }

        if (isset($validated['social']) && is_string($validated['social'])) {
            $decoded = json_decode($validated['social'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $validated['social'] = $decoded;
            }
        }

        try {
            if ($request->hasFile('logo_file')) {
                $upload = FileStorageService::upload($request->file('logo_file'), 'settings');
                $validated['logo'] = $newPaths['logo'] = $upload['path'];
            } elseif (! empty($validated['logo']) && FileStorageService::isManagedReference($validated['logo'])) {
                $validated['logo'] = FileStorageService::normalizePath($validated['logo']);
            }

            if ($request->hasFile('favicon_file')) {
                $upload = FileStorageService::upload($request->file('favicon_file'), 'settings');
                $validated['favicon'] = $newPaths['favicon'] = $upload['path'];
            } elseif (! empty($validated['favicon']) && FileStorageService::isManagedReference($validated['favicon'])) {
                $validated['favicon'] = FileStorageService::normalizePath($validated['favicon']);
            }

            $setting->update($validated);

            if (! empty($validated['timezone']) && in_array($validated['timezone'], timezone_identifiers_list(), true)) {
                date_default_timezone_set($validated['timezone']);
                \Illuminate\Support\Facades\Config::set('app.timezone', $validated['timezone']);
                $connection = \Illuminate\Support\Facades\DB::getDefaultConnection();
                $driver = config("database.connections.{$connection}.driver");
                if ($driver === 'pgsql') {
                    \Illuminate\Support\Facades\DB::statement("SET TIME ZONE '{$validated['timezone']}'");
                }
            }
        } catch (\Throwable $exception) {
            foreach ($newPaths as $path) {
                FileStorageService::delete($path);
            }
            throw $exception;
        }

        if (array_key_exists('logo', $validated) && $oldLogo
            && ! FileStorageService::referencesMatch($oldLogo, $validated['logo'])) {
            FileStorageService::delete($oldLogo);
        }
        if (array_key_exists('favicon', $validated) && $oldFavicon
            && ! FileStorageService::referencesMatch($oldFavicon, $validated['favicon'])) {
            FileStorageService::delete($oldFavicon);
        }

        return response()->json([
            'message' => 'Configuración actualizada correctamente',
            'setting' => $setting->fresh(),
        ], 200);
    }

    /**
     * Garantiza de forma resiliente que las columnas de secciones existan en la tabla settings del tenant.
     */
    private function ensureSettingColumnsExist(): void
    {
        try {
            if (!Schema::hasTable('settings')) {
                return;
            }

            $columns = [
                'enable_customers' => false,
                'enable_suppliers' => false,
                'enable_locations' => false,
            ];

            foreach ($columns as $column => $default) {
                if (!Schema::hasColumn('settings', $column)) {
                    try {
                        Schema::table('settings', function (Blueprint $table) use ($column, $default) {
                            $table->boolean($column)->default($default);
                        });
                    } catch (\Throwable $t) {
                        // Ignorar si se agregó concurrentemente
                    }
                }
            }
        } catch (\Throwable $e) {
            // Ignorar
        }
    }
}
