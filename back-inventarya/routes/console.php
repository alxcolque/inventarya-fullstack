<?php

use App\Models\Tenant;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Artisan::command('tenants:list', function () {
    $tenants = Tenant::with('domains')->get();
    if ($tenants->isEmpty()) {
        $this->info('No tenants found in the central database.');

        return;
    }

    $headers = ['ID', 'Name', 'Slug', 'Status', 'Database', 'Primary Domain'];
    $data = [];

    foreach ($tenants as $tenant) {
        $primaryDomain = $tenant->domains->firstWhere('is_primary', true)->domain ?? 'None';
        $data[] = [
            $tenant->id,
            $tenant->name,
            $tenant->slug,
            $tenant->status,
            $tenant->database,
            $primaryDomain,
        ];
    }

    $this->table($headers, $data);
})->purpose('List all registered tenants and their metadata');

Artisan::command('tenants:check {id}', function ($id) {
    $tenant = Tenant::find($id);
    if (! $tenant) {
        $this->error("Tenant '{$id}' not found.");

        return;
    }

    $this->info("Checking status for Tenant: {$tenant->name} (ID: {$tenant->id})");

    // 1. Check database connectivity
    $dbName = $tenant->getDatabaseName();
    $this->comment("Database Name: {$dbName}");

    $centralConfig = config('database.connections.central');
    $host = $centralConfig['host'] ?? '127.0.0.1';
    $port = $centralConfig['port'] ?? '5432';
    $username = $centralConfig['username'] ?? 'postgres';
    $password = $centralConfig['password'] ?? 'postgres';

    $dsn = "pgsql:host={$host};port={$port};dbname=postgres";
    try {
        $pdo = new \PDO($dsn, $username, $password);
        $stmt = $pdo->prepare('SELECT 1 FROM pg_database WHERE datname = :dbname');
        $stmt->execute(['dbname' => $dbName]);
        $exists = $stmt->fetchColumn();

        if ($exists) {
            $this->info('[OK] PostgreSQL database exists on host.');

            // Try direct connection to the tenant database
            $tenantDsn = "pgsql:host={$host};port={$port};dbname={$dbName}";
            try {
                $tenantPdo = new \PDO($tenantDsn, $username, $password);
                $this->info('[OK] Successfully connected to tenant database.');

                // Check migrations table
                $tablesQuery = $tenantPdo->query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
                $tables = $tablesQuery->fetchAll(\PDO::FETCH_COLUMN);
                $this->info('[INFO] Tables found: '.implode(', ', $tables));
            } catch (\PDOException $e) {
                $this->error('[FAIL] Database exists but cannot connect: '.$e->getMessage());
            }
        } else {
            $this->error('[FAIL] PostgreSQL database does not exist on host.');
        }
    } catch (\PDOException $e) {
        $this->error('[FAIL] Could not connect to PostgreSQL host: '.$e->getMessage());
    }

    // 2. Check domains
    $domains = $tenant->domains;
    if ($domains->isEmpty()) {
        $this->warn('[WARN] Tenant has no domains registered.');
    } else {
        foreach ($domains as $domain) {
            $this->info("[OK] Registered Domain: {$domain->domain} (Primary: ".($domain->is_primary ? 'Yes' : 'No').", Status: {$domain->status})");
        }
    }
})->purpose('Validate connectivity and migration state for a tenant');

Artisan::command('tenants:provision {id}', function ($id) {
    $tenant = Tenant::find($id);
    if (! $tenant) {
        $this->error("Tenant '{$id}' not found.");

        return;
    }

    $this->info("Manually provisioning database, migrations, and seeders for Tenant: {$tenant->name}");

    try {
        $provisionService = app(\App\Services\TenantProvisionService::class);

        // Decrypt password if it exists
        $encryptedPassword = $tenant->data['owner_password_encrypted'] ?? null;
        $password = $encryptedPassword ? \Illuminate\Support\Facades\Crypt::decryptString($encryptedPassword) : 'password';

        $provisionService->provision($tenant, $password);
        $this->info('[OK] Successfully provisioned tenant.');
    } catch (\Exception $e) {
        $this->error('[FAIL] Provisioning failed: '.$e->getMessage());
    }
})->purpose('Manually provision a tenant database, run migrations and seeders');

/* =========================================================================
 * SCHEDULER: Tareas Programadas de Notificaciones e Inventario
 * ========================================================================= */
\Illuminate\Support\Facades\Schedule::command('inventarya:check-expiring-products')
    ->daily()
    ->withoutOverlapping()
    ->description('Revisión diaria de productos próximos a caducar');

\Illuminate\Support\Facades\Schedule::command('inventarya:check-subscriptions')
    ->daily()
    ->withoutOverlapping()
    ->description('Revisión diaria de vencimiento de suscripciones de clientes');

\Illuminate\Support\Facades\Schedule::command('siat:refresh-cufds')
    ->hourly()
    ->withoutOverlapping()
    ->description('Verificación periódica de vigencia y renovación preventiva de CUFD SIAT');

\Illuminate\Support\Facades\Schedule::command('siat:refresh-cuis')
    ->daily()
    ->withoutOverlapping()
    ->description('Verificación periódica de vigencia y renovación preventiva de CUIS SIAT');

\Illuminate\Support\Facades\Schedule::command('siat:verify-pending')
    ->everyTenMinutes()
    ->withoutOverlapping()
    ->description('Reconciliación conservadora periódica de facturas SIAT en estado PROCESSING');
