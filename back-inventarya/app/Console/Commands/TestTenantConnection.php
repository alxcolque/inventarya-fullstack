<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class TestTenantConnection extends Command
{
    protected $signature = 'tenancy:test-connection {tenant_id}';
    protected $description = 'Test that tenancy properly switches DB connections for a tenant';

    public function handle(): int
    {
        $tenantId = $this->argument('tenant_id');

        $this->info("=== Tenant Connection Test: {$tenantId} ===");

        $tenant = \App\Models\Tenant::find($tenantId);
        if (!$tenant) {
            $this->error("Tenant '{$tenantId}' not found.");
            return 1;
        }

        $this->line("database column: " . $tenant->database);
        $this->line("getDatabaseName(): " . $tenant->getDatabaseName());
        $this->line("getInternal(db_name): " . $tenant->getInternal('db_name'));

        $this->line("Before initialize — default: " . config('database.default'));

        tenancy()->initialize($tenant);

        $this->line("After initialize — default: " . config('database.default'));
        $this->line("Connected to: " . DB::connection()->getDatabaseName());

        $tables = DB::select("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
        $this->line("Tables count: " . count($tables));
        foreach ($tables as $t) {
            $this->line("  - {$t->table_name}");
        }

        tenancy()->end();
        $this->line("After end — default: " . config('database.default'));

        $this->info("=== TEST COMPLETE ===");
        return 0;
    }
}
