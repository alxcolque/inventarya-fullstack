<?php

namespace App\Console\Commands;

use App\Models\Store;
use App\Models\Tenant;
use App\Services\Siat\SiatServiceFactory;
use Illuminate\Console\Command;

/**
 * SiatRefreshCuis
 *
 * Revisa la vigencia del CUIS de todas las Stores con facturación habilitada.
 * Renueva el CUIS únicamente si se encuentra dentro de la ventana de renovación
 * legal (valid_until - 5 días) o si se especifica --force.
 *
 * Uso: php artisan siat:refresh-cuis [--tenant=ID] [--force]
 */
class SiatRefreshCuis extends Command
{
    protected $signature = 'siat:refresh-cuis
                            {--tenant= : ID de un tenant específico (opcional)}
                            {--force   : Fuerza la renovación aunque el CUIS esté fuera de ventana}';

    protected $description = 'Verifica periódicamente la vigencia y renueva el CUIS en ventana preventiva para tiendas habilitadas.';

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

        $this->info("Verificando vigencia de CUIS para {$tenants->count()} tenant(s)...");

        $success = 0;
        $failed  = 0;

        foreach ($tenants as $tenant) {
            try {
                $tenant->run(function () use ($tenant, $force, &$success, &$failed) {
                    $stores = Store::where('enable_electronic_invoicing', true)->get();

                    if ($stores->isEmpty()) {
                        $this->line("  [{$tenant->id}] Sin tiendas con facturación habilitada. Saltando.");
                        return;
                    }

                    try {
                        $service = $this->factory->makeForCurrentTenant();
                    } catch (\Throwable $e) {
                        $this->warn("  [{$tenant->id}] No se pudo inicializar SiatService: {$e->getMessage()}");
                        $failed++;
                        return;
                    }

                    foreach ($stores as $store) {
                        try {
                            if ($force) {
                                $service->refreshCuis($store);
                            } else {
                                $service->getCuis($store); // solo renueva si está en ventana de 5 días o expirado
                            }
                            $this->line("  [{$tenant->id}] Store '{$store->name}': CUIS OK");
                            $success++;
                        } catch (\Throwable $e) {
                            $this->error("  [{$tenant->id}] Store '{$store->name}': FALLO — {$e->getMessage()}");
                            $failed++;
                        }
                    }
                });
            } catch (\Throwable $e) {
                $this->error("  [{$tenant->id}] Error de contexto tenant: {$e->getMessage()}");
                $failed++;
            }
        }

        $this->info("Finalizado. OK: {$success} | FALLO: {$failed}");
        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
