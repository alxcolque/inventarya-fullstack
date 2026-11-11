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
        Schema::table('sales', function (Blueprint $table) {
            $table->timestamp('cancelled_at')->nullable()->after('observation');
            $table->foreignId('cancelled_by')->nullable()->after('cancelled_at')->constrained('users')->restrictOnDelete();
            $table->string('cancellation_reason', 255)->nullable()->after('cancelled_by');
            $table->foreignUuid('cancellation_refund_id')->nullable()->unique()->after('cancellation_reason')->constrained('sale_refunds')->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropForeign(['cancellation_refund_id']);
            $table->dropForeign(['cancelled_by']);
            $table->dropColumn([
                'cancelled_at',
                'cancelled_by',
                'cancellation_reason',
                'cancellation_refund_id',
            ]);
        });
    }
};
