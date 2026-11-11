<?php

namespace App\Console\Commands;

use App\Models\InventoryStore;
use App\Models\Tenant;
use App\Services\Notifications\NotificationRecipientResolver;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckExpiringProducts extends Command
{
    protected $signature = 'inventarya:check-expiring-products {--days=30 : Ventana máxima de revisión}';

    protected $description = 'Revisa productos próximos a vencer o vencidos y notifica una vez por umbral';

    public function handle(
        NotificationRecipientResolver $resolver,
        NotificationService $notificationService,
    ) {
        $days = (int) $this->option('days');
        $tenants = Tenant::all();

        foreach ($tenants as $tenant) {
            $tenant->run(function () use ($tenant, $days, $resolver, $notificationService) {
                $this->line("Revisando productos por vencer en tenant: {$tenant->name}...");

                $thresholdDate = Carbon::now()->addDays($days)->toDateString();
                $today = Carbon::now()->startOfDay();

                $expiringItems = InventoryStore::with(['product', 'store'])
                    ->whereNotNull('expiration_date')
                    ->where('expiration_date', '<=', $thresholdDate)
                    ->where('stock_quantity', '>', 0)
                    ->get();

                foreach ($expiringItems as $item) {
                    $expDate = Carbon::parse($item->expiration_date)->startOfDay();
                    $daysLeft = (int) $today->diffInDays($expDate, false);
                    $productName = $item->product?->name ?? 'Producto';
                    $storeName = $item->store?->name ?? 'Tienda';
                    $isExpired = $daysLeft <= 0;

                    if (! $isExpired && ! in_array($daysLeft, [30, 15, 7, 3, 1], true)) {
                        continue;
                    }

                    $type = $isExpired ? 'product_expired' : 'product_expiring';
                    $threshold = $isExpired ? 'expired' : (string) $daysLeft;

                    $alreadyNotified = DB::table('notifications')
                        ->where('data->type', $type)
                        ->whereJsonContains('data->product_id', $item->product_id)
                        ->whereJsonContains('data->store_id', $item->store_id)
                        ->whereJsonContains('data->expiration_date', $expDate->toDateString())
                        ->whereJsonContains('data->threshold', $threshold)
                        ->exists();

                    if ($alreadyNotified) {
                        continue;
                    }

                    $recipients = $resolver->tenantInventoryRecipients($item->store_id);
                    if ($recipients->isNotEmpty()) {
                        $payload = [
                            'product_id' => $item->product_id,
                            'product_name' => $productName,
                            'store_id' => $item->store_id,
                            'store_name' => $storeName,
                            'expiration_date' => $expDate->toDateString(),
                            'days_left' => max(0, $daysLeft),
                            'threshold' => $threshold,
                            'action_url' => "/products/{$item->product_id}",
                            'severity' => $isExpired ? 'critical' : 'warning',
                            'resource' => 'product',
                            'resource_id' => (string) $item->product_id,
                        ];

                        $notificationService->sendToRecipients(
                            $recipients,
                            $isExpired ? 'Producto vencido' : 'Producto próximo a vencer',
                            $isExpired
                                ? "El lote de {$productName} alcanzó su fecha de vencimiento en {$storeName}."
                                : "{$productName} vencerá en {$daysLeft} día(s) en {$storeName}.",
                            $payload,
                            $type,
                        );
                    }
                }
            });
        }

        $this->info('Verificación de productos por vencer completada.');

        return 0;
    }
}
