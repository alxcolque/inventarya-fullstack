<?php

namespace App\Services;

use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class TenantProvisionService
{
    /**
     * Full automated provisioning pipeline for a new tenant.
     *
     * STEP 1 → Create PostgreSQL database
     * STEP 2 → Initialize tenancy context
     * STEP 3 → Run tenant migrations
     * STEP 4 → Run tenant seeders
     * STEP 5 → Create owner admin user
     * STEP 6 → Create default settings
     * STEP 7 → Finalize and end tenancy context
     *
     * @param Tenant $tenant
     * @param string $ownerPassword Plain-text password for the owner admin user
     * @throws \Exception
     */
    public function provision(Tenant $tenant, string $ownerPassword): void
    {
        $dbName = $tenant->getDatabaseName();

        Log::info("[Tenant Provisioning] ── STARTING ──", [
            'tenant_id' => $tenant->id,
            'database' => $dbName,
            'owner' => $tenant->owner_email,
            'timestamp' => now()->toIso8601String(),
        ]);

        // STEP 1 — Create the PostgreSQL database (raw PDO, outside any transaction)
        Log::info("[Tenant Provisioning] STEP 1 — Creating PostgreSQL database", [
            'tenant_id' => $tenant->id,
            'db_name' => $dbName,
        ]);
        $tenant->createTenantDatabase();
        Log::info("[Tenant Provisioning] STEP 1 — Database created successfully", ['db_name' => $dbName]);

        try {
            // STEP 2 — Run tenant migrations
            Log::info("[Tenant Provisioning] STEP 2 — Running tenant migrations", ['tenant_id' => $tenant->id]);
            $tenant->runTenantMigrations();
            $migrationOutput = Artisan::output();
            Log::info("[Tenant Provisioning] STEP 2 — Migrations complete", [
                'tenant_id' => $tenant->id,
                'output' => trim($migrationOutput),
            ]);

            // STEP 3 — Run tenant seeders
            Log::info("[Tenant Provisioning] STEP 3 — Running tenant seeders", ['tenant_id' => $tenant->id]);
            $tenant->runTenantSeeders();
            $seederOutput = Artisan::output();
            Log::info("[Tenant Provisioning] STEP 3 — Seeders complete", [
                'tenant_id' => $tenant->id,
                'output' => trim($seederOutput),
            ]);

            // STEPS 4-6 — Owner, settings inside tenant context
            Log::info("[Tenant Provisioning] STEP 4-6 — Setting up owner user and settings", ['tenant_id' => $tenant->id]);
            $this->setupTenantOwnerAndSettings($tenant, $ownerPassword);

            // STEP 7 — Ensure active/trialing subscription exists in central database
            if ($tenant->subscriptions()->count() === 0) {
                $defaultPlan = \App\Models\Plan::where('slug', 'business')->first()
                    ?? \App\Models\Plan::where('slug', 'starter')->first()
                    ?? \App\Models\Plan::first();
                if ($defaultPlan) {
                    app(\App\Services\SubscriptionService::class)->activateTrial($tenant, $defaultPlan);
                    Log::info("[Tenant Provisioning] STEP 7 — Default trialing subscription created", [
                        'tenant_id' => $tenant->id,
                        'plan' => $defaultPlan->name,
                    ]);
                }
            }

            Log::info("[Tenant Provisioning] ── SUCCESS ── Tenant fully provisioned", [
                'tenant_id' => $tenant->id,
                'database' => $dbName,
            ]);
        } catch (\Exception $e) {
            Log::error("[Tenant Provisioning] ── FAILED ── Rolling back", [
                'tenant_id' => $tenant->id,
                'database' => $dbName,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $this->rollbackProvision($tenant);
            throw $e;
        }
    }

    /**
     * Create the owner admin user and default settings inside the tenant database.
     * Runs inside tenant context (tenancy()->initialize() / end()).
     *
     * @param Tenant $tenant
     * @param string $ownerPassword Plain-text password
     */
    public function setupTenantOwnerAndSettings(Tenant $tenant, string $ownerPassword): void
    {
        tenancy()->initialize($tenant);

        try {
            $ownerEmail = $tenant->owner_email ?? 'admin@tenant.com';
            $ownerName = $tenant->owner_name ?? 'Admin';
            $ownerPhone = $tenant->owner_phone ?? '00000000';

            // STEP 4 — Create or update owner user
            $user = \App\Models\User::where('email', $ownerEmail)->first();
            if ($user) {
                $user->name = $ownerName;
                $user->username = explode('@', $ownerEmail)[0];
                $user->password = $ownerPassword;
                $user->role = 'owner';
                $user->status = 'active';
                $user->phone = $ownerPhone;
                $user->save();

                Log::info("[Tenant Provisioning] STEP 4 — Owner user updated", [
                    'tenant_id' => $tenant->id,
                    'email' => $ownerEmail,
                    'role' => 'owner',
                ]);
            } else {
                \App\Models\User::create([
                    'name' => $ownerName,
                    'email' => $ownerEmail,
                    'username' => explode('@', $ownerEmail)[0],
                    'password' => $ownerPassword,
                    'role' => 'owner',
                    'status' => 'active',
                    'phone' => $ownerPhone,
                    'ci' => '00000000',
                ]);

                Log::info("[Tenant Provisioning] STEP 4 — Owner user created", [
                    'tenant_id' => $tenant->id,
                    'email' => $ownerEmail,
                    'role' => 'owner',
                ]);
            }

            // STEP 5 — Initialize or update default settings
            $settings = \App\Models\Setting::first();
            $settingsData = [
                'business_name' => $tenant->name,
                'logo' => $tenant->logo ?? 'https://cdn-icons-png.flaticon.com/512/6858/6858504.png',
                'email' => $ownerEmail,
                'phone' => $ownerPhone,
            ];

            if ($settings) {
                $settings->update($settingsData);
                Log::info("[Tenant Provisioning] STEP 5 — Default settings updated", [
                    'tenant_id' => $tenant->id,
                    'business_name' => $tenant->name,
                ]);
            } else {
                \App\Models\Setting::create($settingsData);
                Log::info("[Tenant Provisioning] STEP 5 — Default settings created", [
                    'tenant_id' => $tenant->id,
                    'business_name' => $tenant->name,
                ]);
            }

            // STEP 6 — Initialize default catalog records (Brand: DESCONOCIDO, Category: VARIOS, Locations: Almacen Central, Tienda)
            $this->setupDefaultCatalog();

            // STEP 7 — Log successful tenant activation
            Log::info("[Tenant Provisioning] STEP 7 — Tenant context setup complete", [
                'tenant_id' => $tenant->id,
                'db_name' => $tenant->getDatabaseName(),
            ]);
        } finally {
            tenancy()->end();
        }
    }

    /**
     * Seed or ensure the default initial records:
     * 1. Brand: DESCONOCIDO
     * 2. Category: VARIOS
     * 3. Locations: Almacen Central, Tienda
     */
    public function setupDefaultCatalog(): void
    {
        // 1. Tabla "brands": DESCONOCIDO
        $brand = \App\Models\Brand::whereRaw('LOWER(name) = ?', ['desconocido'])->first();
        if (!$brand) {
            \App\Models\Brand::create([
                'name' => 'DESCONOCIDO',
                'slug' => 'desconocido',
            ]);
            Log::info("[Tenant Provisioning] Default brand 'DESCONOCIDO' registered");
        }

        // 2. Tabla "categories": VARIOS
        $category = \App\Models\Category::whereRaw('LOWER(name) = ?', ['varios'])->first();
        if (!$category) {
            \App\Models\Category::create([
                'name' => 'VARIOS',
                'slug' => 'varios',
            ]);
            Log::info("[Tenant Provisioning] Default category 'VARIOS' registered");
        } else if ($category->name !== 'VARIOS') {
            $category->update(['name' => 'VARIOS']);
        }

        // 3. Tabla "locations": Almacen Central y Tienda
        $locations = ['Almacen Central', 'Tienda'];
        foreach ($locations as $locName) {
            $loc = \App\Models\Location::whereRaw('LOWER(name) = ?', [mb_strtolower($locName, 'UTF-8')])->first();
            if (!$loc) {
                \App\Models\Location::create([
                    'name' => $locName,
                    'slug' => \Illuminate\Support\Str::slug($locName),
                    'parent_id' => null,
                ]);
                Log::info("[Tenant Provisioning] Default location '{$locName}' registered");
            }
        }
    }

    /**
     * Rollback a failed provisioning by dropping the tenant database.
     */
    public function rollbackProvision(Tenant $tenant): void
    {
        $dbName = $tenant->getDatabaseName();

        Log::warning("[Tenant Provisioning] ROLLBACK — Dropping database", [
            'tenant_id' => $tenant->id,
            'db_name' => $dbName,
        ]);

        try {
            $tenant->dropTenantDatabase();
            Log::info("[Tenant Provisioning] ROLLBACK — Database dropped", ['db_name' => $dbName]);
        } catch (\Exception $e) {
            Log::error("[Tenant Provisioning] ROLLBACK — Failed to drop database", [
                'db_name' => $dbName,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
