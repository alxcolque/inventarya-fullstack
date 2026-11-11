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
            $table->unsignedInteger('cancellation_reason_code')->nullable()->after('status');
            $table->dateTime('cancelled_at', 6)->nullable()->after('cancellation_reason_code');
            $table->unsignedInteger('cancellation_status_code')->nullable()->after('cancelled_at');
            $table->dateTime('cancellation_pending_at', 6)->nullable()->after('cancellation_status_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('electronic_invoices', function (Blueprint $table) {
            $table->dropColumn([
                'cancellation_reason_code',
                'cancelled_at',
                'cancellation_status_code',
                'cancellation_pending_at',
            ]);
        });
    }
};
