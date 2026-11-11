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
        Schema::create('inventory_stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignUuid('store_id')->constrained('stores')->cascadeOnDelete();
            $table->decimal('quantity', 10, 3)->default(0.000);
            $table->double('price')->default(0.00);
            $table->timestamp('restock_date')->nullable();
            $table->decimal('stock_quantity', 10, 3)->default(0.000);
            $table->decimal('min_stock', 10, 3)->default(0.000);
            $table->string('unit', 50);
            $table->double('sale_price')->default(0.00);
            $table->date('expiration_date')->nullable();

            //location_id
            $table->foreignId('location_id')->nullable()->constrained('locations');
            //metadata
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_stores');
    }
};
