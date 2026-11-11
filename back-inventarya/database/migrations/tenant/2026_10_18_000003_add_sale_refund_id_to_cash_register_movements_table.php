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
        Schema::table('cash_register_movements', function (Blueprint $table) {
            $table->foreignUuid('sale_refund_id')
                ->nullable()
                ->unique()
                ->constrained('sale_refunds')
                ->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cash_register_movements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sale_refund_id');
        });
    }
};
