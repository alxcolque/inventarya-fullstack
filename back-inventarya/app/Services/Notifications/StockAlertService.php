<?php

namespace App\Services\Notifications;

use App\Events\Tenant\StockLowEvent;
use App\Events\Tenant\StockOutEvent;
use App\Models\InventoryStore;
use App\Models\InventoryWarehouse;

class StockAlertService
{
    public function transitionType(int $previousStock, int $newStock, int $minimumStock): ?string
    {
        if ($previousStock > 0 && $newStock <= 0) {
            return 'stock_out';
        }

        if ($newStock > 0 && $previousStock > $minimumStock && $newStock <= $minimumStock) {
            return 'stock_low';
        }

        return null;
    }

    public function evaluate(
        InventoryStore|InventoryWarehouse $inventory,
        int $previousStock,
        int $newStock,
    ): void {
        $minimumStock = (int) $inventory->min_stock;
        $type = $this->transitionType($previousStock, $newStock, $minimumStock);

        if ($type === null) {
            return;
        }

        $inventory->loadMissing($inventory instanceof InventoryStore
            ? ['product', 'store']
            : ['product', 'location']);

        $productName = $inventory->product?->name ?? 'Producto';
        $contextName = $inventory instanceof InventoryStore
            ? ($inventory->store?->name ?? 'Tienda')
            : ($inventory->location?->name ?? 'Almacén');
        $storeId = $inventory instanceof InventoryStore ? $inventory->store_id : null;

        $payload = [
            'product_id' => $inventory->product_id,
            'product_name' => $productName,
            'store_id' => $storeId,
            'store_name' => $contextName,
            'current_stock' => $newStock,
            'previous_stock' => $previousStock,
            'min_stock' => $minimumStock,
            'action_url' => "/products/{$inventory->product_id}",
            'title' => $type === 'stock_out' ? 'Producto agotado' : 'Stock bajo',
            'message' => $type === 'stock_out'
                ? "{$productName} se quedó sin existencias en {$contextName}."
                : "{$productName} llegó al stock mínimo. Quedan {$newStock} unidades en {$contextName}.",
        ];

        event($type === 'stock_out'
            ? new StockOutEvent($payload)
            : new StockLowEvent($payload));
    }
}
