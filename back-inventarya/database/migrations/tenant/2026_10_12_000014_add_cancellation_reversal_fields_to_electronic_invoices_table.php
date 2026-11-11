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
        Schema::table('electronic_invoices', function (Blueprint $table) {
            $table->dateTime('cancellation_reversed_at', 6)->nullable()->after('cancellation_pending_at');
            $table->unsignedInteger('cancellation_reversal_status_code')->nullable()->after('cancellation_reversed_at');
            $table->dateTime('cancellation_reversal_pending_at', 6)->nullable()->after('cancellation_reversal_status_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('electronic_invoices', function (Blueprint $table) {
            $table->dropColumn([
                'cancellation_reversed_at',
                'cancellation_reversal_status_code',
                'cancellation_reversal_pending_at',
            ]);
        });
    }
};
