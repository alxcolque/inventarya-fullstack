<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sale_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->string('payment_method', 50)->default('efectivo');
            $table->decimal('amount', 15, 2);
            $table->decimal('amount_received', 15, 2)->nullable();
            $table->decimal('change_amount', 15, 2)->nullable();
            $table->string('reference', 255)->nullable();
            $table->timestamps();

            $table->index('sale_id');
            $table->index('payment_method');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("UPDATE inventory_stores SET stock_quantity = 0 WHERE stock_quantity < 0");
            DB::statement("ALTER TABLE inventory_stores ADD CONSTRAINT inventory_stores_stock_non_negative CHECK (stock_quantity >= 0)");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE inventory_stores DROP CONSTRAINT IF EXISTS inventory_stores_stock_non_negative");
        }

        Schema::dropIfExists('sale_payments');
    }
};
