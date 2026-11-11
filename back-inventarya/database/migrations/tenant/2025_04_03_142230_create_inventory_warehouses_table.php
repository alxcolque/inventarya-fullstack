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
        Schema::create('inventory_warehouses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('unit', 100)->nullable();
            $table->decimal('quantity', 10, 2)->default(0.00);
            $table->double('price')->default(0.00);
            $table->double('sale_price')->default(0.00);
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->timestamp('restock_date')->nullable();
            $table->decimal('stock_quantity', 10, 2)->default(0.00);
            $table->decimal('min_stock', 10, 2)->default(0.00);
            $table->date('expiration_date')->nullable();

            // Location
            $table->unsignedBigInteger('location_id')->nullable();

            // Metadata
            $table->json('metadata')->nullable();
            $table->timestamps();

            // Performance indexes
            $table->index('supplier_id');
            $table->index('location_id');
            $table->index('stock_quantity');
            $table->index('created_at');
            $table->index(['product_id', 'unit']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_warehouses');
    }
};
