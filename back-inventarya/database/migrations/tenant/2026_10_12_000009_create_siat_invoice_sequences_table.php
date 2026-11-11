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
        Schema::create('siat_invoice_sequences', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->nullable()->constrained('stores')->nullOnDelete();
            $table->integer('branch_code');
            $table->integer('point_of_sale_code');
            $table->bigInteger('last_number')->default(0);
            $table->timestamps();

            // Alcance normativo fiscal del SIN: el correlativo es único e indivisible por punto fiscal (sucursal + punto de venta)
            $table->unique(
                ['branch_code', 'point_of_sale_code'],
                'siat_invoice_sequences_branch_pos_unique'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('siat_invoice_sequences');
    }
};
