<?php

namespace App\Services\Siat;

use App\Models\SiatInvoiceSequence;
use App\Models\Store;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SiatInvoiceNumberService
{
    /**
     * Obtiene y reserva atómicamente el siguiente número correlativo fiscal
     * para la sucursal y punto de venta autorizados en el tenant.
     *
     * Estrategia de concurrencia:
     *  1. Transacción DB.
     *  2. INSERT ... ON CONFLICT (branch_code, point_of_sale_code) DO NOTHING
     *     (elimina la condición de carrera en la creación inicial de la secuencia).
     *  3. SELECT ... FOR UPDATE (bloqueo pesimista exclusivo por punto fiscal).
     *  4. Incremento atómico y retorno del número asignado.
     *
     * Alcance normativo:
     *  La numeración es única por punto fiscal (sucursal + punto de venta) en el contribuyente.
     *  No se reinicia por día, mes, año, renovación CUFD ni renovación CUIS.
     *
     * @param Store $store Tienda que emite
     * @param int $branchCode Código oficial de sucursal (0 es válido)
     * @param int $pointOfSaleCode Código oficial de punto de venta (0 es válido)
     * @return int Número correlativo fiscal asignado
     */
    public function getNextInvoiceNumber(Store $store, int $branchCode, int $pointOfSaleCode): int
    {
        return DB::transaction(function () use ($store, $branchCode, $pointOfSaleCode) {
            $now = now();
            $uuid = (string) Str::uuid();

            // 1. Inserción segura atómica que absorbe carreras concurrentes en la inicialización
            DB::statement("
                INSERT INTO siat_invoice_sequences (id, branch_code, point_of_sale_code, store_id, last_number, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, ?, ?)
                ON CONFLICT (branch_code, point_of_sale_code) DO NOTHING
            ", [
                $uuid,
                $branchCode,
                $pointOfSaleCode,
                $store->id,
                $now,
                $now,
            ]);

            // 2. Bloqueo pesimista exclusivo en la fila de secuencia existente
            $sequence = SiatInvoiceSequence::where('branch_code', $branchCode)
                ->where('point_of_sale_code', $pointOfSaleCode)
                ->lockForUpdate()
                ->firstOrFail();

            $nextNumber = $sequence->last_number + 1;
            $sequence->last_number = $nextNumber;
            $sequence->store_id    = $store->id;
            $sequence->save();

            return $nextNumber;
        });
    }

    /**
     * Consulta el último número fiscal emitido sin incrementarlo.
     */
    public function getCurrentInvoiceNumber(int|Store $branchOrStore, int $posOrBranch, ?int $pointOfSaleCode = null): int
    {
        if ($branchOrStore instanceof Store) {
            $branch = $posOrBranch;
            $pos    = (int) $pointOfSaleCode;
        } else {
            $branch = (int) $branchOrStore;
            $pos    = (int) $posOrBranch;
        }

        $sequence = SiatInvoiceSequence::where('branch_code', $branch)
            ->where('point_of_sale_code', $pos)
            ->first();

        return $sequence ? (int) $sequence->last_number : 0;
    }
}
