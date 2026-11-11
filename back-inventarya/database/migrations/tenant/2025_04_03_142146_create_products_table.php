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
        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained('brands')->nullOnDelete();
            $table->string('name', 150);
            $table->string('slug', 150)->unique();

            $table->string('sku', 100)->nullable()->unique();
            $table->string('barcode', 100)->nullable()->index();

            $table->text('description')->nullable();
            $table->string('image', 255)->nullable();

            // Facturación electrónica (SIAT / SIN)
            $table->string('sin_product_code')->nullable();
            $table->string('sin_activity_code')->nullable();
            $table->integer('sin_unit_code')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
