<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Cabecera de devolución comercial
        Schema::create('sale_refunds', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sale_id')->constrained('sales')->restrictOnDelete();
            $table->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->string('status', 50)->default('completed');
            $table->string('reason', 255)->nullable();
            $table->text('notes')->nullable();
            $table->decimal('total', 15, 2)->default(0.00);
            $table->timestamps();

            $table->index('sale_id');
            $table->index('store_id');
            $table->index('user_id');
            $table->index('status');
        });

        // 2. Líneas devueltas con snapshots históricos
        Schema::create('sale_refund_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sale_refund_id')->constrained('sale_refunds')->cascadeOnDelete();
            $table->foreignUuid('sale_detail_id')->constrained('sale_details')->restrictOnDelete();
            $table->uuid('product_id')->nullable();
            $table->string('product_name', 255)->nullable();
            $table->string('product_sku', 100)->nullable();
            $table->decimal('quantity', 15, 3)->default(0.000);
            $table->decimal('unit_price', 15, 2)->default(0.00);
            $table->decimal('subtotal', 15, 2)->default(0.00);
            $table->timestamps();

            $table->index('sale_refund_id');
            $table->index('sale_detail_id');
            $table->index('product_id');
        });

        // 3. Desglose de pagos devueltos por método
        Schema::create('sale_refund_payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sale_refund_id')->constrained('sale_refunds')->cascadeOnDelete();
            $table->string('payment_method', 50)->default('efectivo');
            $table->decimal('amount', 15, 2)->default(0.00);
            $table->string('reference', 255)->nullable();
            $table->timestamps();

            $table->index('sale_refund_id');
            $table->index('payment_method');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_refund_payments');
        Schema::dropIfExists('sale_refund_items');
        Schema::dropIfExists('sale_refunds');
    }
};
