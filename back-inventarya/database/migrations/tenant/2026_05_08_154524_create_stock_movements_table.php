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
        // 1. LA CABECERA: Registra el viaje, el documento general y los responsables
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // De dónde sale y a dónde va (Almacén -> Tienda)
            $table->uuid('source_warehouse_id')->nullable();
            $table->foreignUuid('destination_store_id')->nullable()->constrained('stores');

            // Quién autoriza el movimiento
            $table->foreignId('user_id')->constrained('users');

            // Documentación Legal para el transporte
            $table->string('document_type', 50)->default('Guía de Remisión');
            $table->string('document_number', 100)->unique(); // Código único de la guía

            // Estados del carrito/transferencia
            $table->enum('status', ['pending', 'in_transit', 'completed', 'returned', 'cancelled'])->default('in_transit');
            $table->text('notes')->nullable(); // Ej: "Traslado de urgencia por campaña navideña"

            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
        });

        // 2. EL DETALLE (El Carrito): Registra cada producto que va dentro de ese movimiento
        Schema::create('stock_movement_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('stock_movement_id')->constrained('stock_movements')->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained('products');

            $table->decimal('quantity', 10, 2)->default(0.00); // Cantidad transferida
            $table->double('cost_price')->default(0.00); // El precio que tenía en almacén
            $table->double('sale_price')->default(0.00); // El precio con el que se venderá en tienda
            $table->string('unit', 50)->nullable();
            $table->decimal('min_stock', 10, 2)->default(0.00);
            $table->date('expiration_date')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_movement_items');
        Schema::dropIfExists('stock_movements');
    }
};
