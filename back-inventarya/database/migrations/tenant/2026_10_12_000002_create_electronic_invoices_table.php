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
        Schema::create('electronic_invoices', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sale_id')->unique()->constrained('sales')->restrictOnDelete();
            $table->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $table->foreignUuid('siat_cufd_id')->nullable()->constrained('siat_cufds')->restrictOnDelete();

            // Snapshot del Emisor
            $table->string('issuer_nit', 50);
            $table->string('issuer_business_name', 200);
            $table->string('issuer_municipality', 100)->nullable();
            $table->string('issuer_address', 255)->nullable();
            $table->string('issuer_phone', 50)->nullable();
            $table->integer('branch_code');
            $table->integer('point_of_sale_code');
            $table->integer('siat_environment');
            $table->integer('siat_modality');

            // Snapshot del Comprador
            $table->integer('buyer_document_type');
            $table->string('buyer_document_number', 50);
            $table->string('buyer_document_complement', 20)->nullable();
            $table->string('buyer_name', 200);
            $table->string('buyer_customer_code', 50)->nullable();

            // Identificación del Documento Fiscal (emisión futura)
            $table->bigInteger('invoice_number')->nullable();
            $table->string('cuf', 255)->nullable()->unique();
            $table->string('cufd_snapshot', 150)->nullable();
            $table->string('control_code', 50)->nullable();
            $table->timestamp('issued_at', 3)->nullable();
            $table->integer('document_sector_code')->default(1);

            // Importes monetarios
            $table->decimal('subtotal', 15, 2);
            $table->decimal('discount', 15, 2)->default(0.00);
            $table->decimal('additional_discount', 15, 2)->default(0.00);
            $table->decimal('gift_card_amount', 15, 2)->default(0.00);
            $table->decimal('total', 15, 2);
            $table->decimal('total_subject_to_vat', 15, 2)->nullable();

            // Moneda y Pagos
            $table->integer('currency_code')->default(1);
            $table->decimal('exchange_rate', 10, 5)->default(1.00000);
            $table->decimal('total_in_currency', 15, 2)->nullable();
            $table->integer('payment_method_code')->default(1);
            $table->string('card_number', 20)->nullable();

            // Parámetros y Leyenda Fiscal
            $table->integer('exception_code')->nullable();
            $table->string('cafc', 50)->nullable();
            $table->text('legend')->nullable();
            $table->string('issued_by', 100)->nullable();

            // Estado interno de procesamiento
            $table->string('status', 30)->default('draft');

            // Respuestas técnicas futuras del SIAT
            $table->string('reception_code', 100)->nullable();
            $table->jsonb('sin_response')->nullable();
            $table->text('error_message')->nullable();

            // Documentos generados (referencias)
            $table->string('xml_path', 255)->nullable();
            $table->string('pdf_path', 255)->nullable();

            $table->timestamps();

            // Índices para consultas y reportes
            $table->index('store_id');
            $table->index('status');
            $table->index('issued_at');
            $table->index(['store_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('electronic_invoices');
    }
};
