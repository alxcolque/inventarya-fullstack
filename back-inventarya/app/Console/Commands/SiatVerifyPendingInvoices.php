<?php

namespace App\Console\Commands;

use App\Enums\ElectronicInvoiceStatus;
use App\Models\ElectronicInvoice;
use App\Models\Tenant;
use App\Services\Siat\SiatInvoiceVerificationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * SiatVerifyPendingInvoices
 *
 * Comando de reconciliación periódica y conservadora (Fase 4F).
 * Busca facturas en estado PROCESSING que han alcanzado su ventana de backoff
 * y ejecuta verificacionEstadoFactura ante el SIN sin realizar reenvíos ciegos.
 *
 * Uso: php artisan siat:verify-pending [--tenant=ID] [--limit=50] [--force]
 */
class SiatVerifyPendingInvoices extends Command
{
    protected $signature = 'siat:verify-pending
                            {--tenant= : ID de un tenant específico (opcional)}
                            {--limit=50 : Límite de facturas a reconciliar por tenant}
                            {--force   : Fuerza la verificación ignorando la fecha de backoff}';

    protected $description = 'Reconcilia periódicamente facturas en estado PROCESSING elegibles según su ventana de backoff.';

    public function __construct(
        private readonly SiatInvoiceVerificationService $verificationService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $tenantId = $this->option('tenant');
        $limit    = (int) $this->option('limit');
        $force    = (bool) $this->option('force');

        // Si la aplicación se ejecuta en contexto de tenant directo o entorno de prueba con conexión activa
        if (tenancy()->initialized || (app()->runningUnitTests() && Schema::hasTable('electronic_invoices'))) {
            return $this->reconcileCurrentTenant($limit, $force);
        }

        $query = Tenant::query();
        if ($tenantId) {
            $query->where('id', $tenantId);
        }

        $tenants = $query->get();

        if ($tenants->isEmpty()) {
            $this->warn('No se encontraron tenants para reconciliar facturas.');
            return self::SUCCESS;
        }

        $this->info("Iniciando reconciliación fiscal para {$tenants->count()} tenant(s)...");

        $totalReconciled = 0;
        $totalFailed = 0;

        foreach ($tenants as $tenant) {
            try {
                $tenant->run(function () use ($limit, $force, &$totalReconciled, &$totalFailed) {
                    $this->reconcileCurrentTenant($limit, $force, $totalReconciled, $totalFailed);
                });
            } catch (Throwable $e) {
                $this->error("Error al procesar tenant '{$tenant->id}': " . $e->getMessage());
                $totalFailed++;
            }
        }

        $this->info("Reconciliación completada. Facturas procesadas con éxito: {$totalReconciled}, fallidas: {$totalFailed}.");

        return self::SUCCESS;
    }

    /**
     * Reconcilia las facturas elegibles en el contexto del tenant activo.
     */
    public function reconcileCurrentTenant(
        int $limit = 50,
        bool $force = false,
        int &$successCount = 0,
        int &$failedCount = 0
    ): int {
        $query = ElectronicInvoice::where('status', ElectronicInvoiceStatus::PROCESSING)
            ->whereNotNull('cuf')
            ->where('verification_attempts', '<', SiatInvoiceVerificationService::MAX_AUTOMATIC_VERIFICATION_ATTEMPTS);

        if (!$force) {
            $query->where(function ($q) {
                $q->whereNull('next_verification_at')
                  ->orWhere('next_verification_at', '<=', now());
            });
        }

        $invoices = $query->orderBy('last_verified_at', 'asc')
            ->limit($limit)
            ->get();

        if ($invoices->isEmpty()) {
            $this->line('  No hay facturas pendientes de reconciliación en este momento.');
            return self::SUCCESS;
        }

        $this->info("  Procesando {$invoices->count()} factura(s) pendiente(s)...");

        foreach ($invoices as $invoice) {
            try {
                $result = $this->verificationService->verify($invoice);

                $statusLabel = strtoupper($result['status']);
                $code = $result['codigo_estado'] ?? 'N/A';

                $this->line("  [Factura #{$invoice->invoice_number}] CUF: " . substr($invoice->cuf, 0, 8) . "... → {$statusLabel} (Código: {$code})");
                $successCount++;

            } catch (Throwable $e) {
                $this->warn("  [Factura #{$invoice->invoice_number}] Fallo en verificación: " . $e->getMessage());
                $failedCount++;
            }
        }

        return self::SUCCESS;
    }
}
