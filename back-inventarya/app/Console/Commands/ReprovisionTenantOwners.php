<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Services\TenantProvisionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ReprovisionTenantOwners extends Command
{
    protected $signature = 'tenancy:reprovision-owners {--tenants= : Comma-separated list of tenant IDs}';
    protected $description = 'Re-run owner and settings setup for existing tenants inside their databases';

    public function handle(): int
    {
        $tenantIds = $this->option('tenants')
            ? explode(',', $this->option('tenants'))
            : null;

        $query = Tenant::query();
        if ($tenantIds) {
            $query->whereIn('id', $tenantIds);
        }

        $tenants = $query->get();

        if ($tenants->isEmpty()) {
            $this->warn('No tenants found.');
            return 0;
        }

        $service = app(TenantProvisionService::class);

        foreach ($tenants as $tenant) {
            $this->info("Setting up owner/settings for tenant: {$tenant->id}");
            $this->line("  DB: " . $tenant->getDatabaseName());

            try {
                // Use the owner password from the encrypted data, or a default
                $ownerPassword = null;
                if (isset($tenant->data['owner_password_encrypted'])) {
                    $ownerPassword = \Illuminate\Support\Facades\Crypt::decryptString($tenant->data['owner_password_encrypted']);
                }

                $service->setupTenantOwnerAndSettings($tenant, $ownerPassword ?? 'password');
                $this->info("  ✅ Done for tenant: {$tenant->id}");
            } catch (\Exception $e) {
                $this->error("  ❌ Failed for tenant: {$tenant->id} — " . $e->getMessage());
                Log::error("ReprovisionTenantOwners failed for {$tenant->id}", ['error' => $e->getMessage()]);
            }
        }

        $this->info("=== Reprovisioning complete ===");
        return 0;
    }
}
