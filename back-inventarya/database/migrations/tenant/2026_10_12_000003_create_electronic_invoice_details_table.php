<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('electronic_invoice_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('electronic_invoice_id')->constrained('electronic_invoices')->cascadeOnDelete();
            $table->foreignUuid('product_id')->nullable()->constrained('products')->nullOnDelete();

            // Snapshot del Producto/Servicio
            $table->string('product_code', 100)->nullable();
            $table->string('sin_product_code', 100)->nullable();
            $table->string('sin_activity_code', 100)->nullable();
            $table->integer('sin_unit_code')->nullable();
            $table->text('description');

            // Importes y cantidades
            $table->decimal('quantity', 15, 3);
            $table->decimal('unit_price', 15, 2);
            $table->decimal('discount', 15, 2)->default(0.00);
            $table->decimal('subtotal', 15, 2);
            $table->string('serial_number', 100)->nullable();
            $table->string('imei_number', 100)->nullable();

            $table->timestamps();

            $table->index('electronic_invoice_id');
            $table->index('product_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('electronic_invoice_details');
    }
};
