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
        // 1. Ampliar electronic_invoices con control de reconciliación y backoff
        Schema::table('electronic_invoices', function (Blueprint $table) {
            $table->unsignedInteger('verification_attempts')->default(0)->after('error_message');
            $table->timestamp('last_verified_at')->nullable()->after('verification_attempts');
            $table->timestamp('next_verification_at')->nullable()->after('last_verified_at');
            $table->index(['status', 'next_verification_at'], 'electronic_invoices_reconciliation_idx');
        });

        // 2. Crear tabla histórica de operaciones SIAT (submit, verify, etc.)
        Schema::create('siat_invoice_operations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('electronic_invoice_id')->constrained('electronic_invoices')->cascadeOnDelete();
            $table->string('operation', 50); // 'submit', 'verify'
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->string('transport_status', 30); // 'success', 'timeout', 'error'
            $table->integer('siat_status_code')->nullable();
            $table->string('reception_code', 150)->nullable();
            $table->json('response')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['electronic_invoice_id', 'operation'], 'siat_invoice_ops_invoice_op_idx');
            $table->index(['operation', 'created_at'], 'siat_invoice_ops_op_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('siat_invoice_operations');

        Schema::table('electronic_invoices', function (Blueprint $table) {
            $table->dropIndex('electronic_invoices_reconciliation_idx');
            $table->dropColumn([
                'verification_attempts',
                'last_verified_at',
                'next_verification_at',
            ]);
        });
    }
};
