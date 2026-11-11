<?php

namespace App\Console\Commands;

use App\Models\Store;
use App\Models\Tenant;
use App\Services\Siat\SiatServiceFactory;
use Illuminate\Console\Command;

/**
 * SiatSyncCancellationReasons
 *
 * Sincroniza el catálogo oficial de motivos de anulación del SIN para cada tenant.
 *
 * Uso: php artisan siat:sync-cancellation-reasons [--tenant=ID] [--force]
 */
class SiatSyncCancellationReasons extends Command
{
    protected $signature = 'siat:sync-cancellation-reasons
                            {--tenant= : ID de un tenant específico (opcional)}
                            {--force   : Forzar sincronización omitiendo caché local}';

    protected $description = 'Sincroniza y persiste el catálogo oficial de motivos de anulación del SIN.';

    public function __construct(
        private readonly SiatServiceFactory $factory,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $tenantId = $this->option('tenant');
        $force    = (bool) $this->option('force');

        $query = Tenant::query();
        if ($tenantId) {
            $query->where('id', $tenantId);
        }

        $tenants = $query->get();

        if ($tenants->isEmpty()) {
            $this->warn('No se encontraron tenants.');
            return self::SUCCESS;
        }

        $this->info("Sincronizando motivos de anulación para {$tenants->count()} tenant(s)...");

        $success = 0;
        $failed  = 0;

        foreach ($tenants as $tenant) {
            try {
                $tenant->run(function () use ($tenant, $force, &$success, &$failed) {
                    $store = Store::where('enable_electronic_invoicing', true)->first();

                    if (!$store) {
                        $this->line("  [Tenant: {$tenant->id}] Omitido (no tiene tiendas con facturación electrónica).");
                        return;
                    }

                    $siatService = $this->factory->makeForTenant($tenant);
                    $reasons = $siatService->getCatalog('MotivoAnulacion', $store, $force);

                    $this->info("  [Tenant: {$tenant->id}] Sincronizados " . count($reasons) . ' motivos de anulación.');
                    $success++;
                });
            } catch (\Throwable $e) {
                $this->error("  [Tenant: {$tenant->id}] Falló la sincronización: {$e->getMessage()}");
                $failed++;
            }
        }

        $this->info("Proceso completado. Exitosos: {$success}, Fallidos: {$failed}.");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
