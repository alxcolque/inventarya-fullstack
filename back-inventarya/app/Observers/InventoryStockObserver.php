<?php

namespace App\Observers;

use App\Models\InventoryStore;
use App\Models\InventoryWarehouse;
use App\Services\Notifications\StockAlertService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InventoryStockObserver
{
    public function __construct(
        private readonly StockAlertService $stockAlertService,
    ) {}

    public function updated(Model $inventory): void
    {
        if (! $inventory->wasChanged('stock_quantity')) {
            return;
        }

        if (! $inventory instanceof InventoryStore && ! $inventory instanceof InventoryWarehouse) {
            return;
        }

        $inventoryClass = $inventory::class;
        $inventoryId = $inventory->getKey();
        $previousStock = (int) $inventory->getRawOriginal('stock_quantity');
        $newStock = (int) $inventory->stock_quantity;

        DB::afterCommit(function () use ($inventoryClass, $inventoryId, $previousStock, $newStock) {
            $freshInventory = $inventoryClass::query()->find($inventoryId);

            if ($freshInventory) {
                try {
                    $this->stockAlertService->evaluate($freshInventory, $previousStock, $newStock);
                } catch (\Throwable $exception) {
                    Log::error('No se pudo despachar una alerta de inventario después del commit.', [
                        'inventory_type' => $inventoryClass,
                        'inventory_id' => $inventoryId,
                        'previous_stock' => $previousStock,
                        'new_stock' => $newStock,
                        'exception' => $exception->getMessage(),
                    ]);
                }
            }
        });
    }
}
