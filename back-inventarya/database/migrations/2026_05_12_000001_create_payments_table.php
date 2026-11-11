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
        Schema::create('payments', function (Blueprint $table) {
            $table->id();

            // tenant
            $table->string('tenant_id', 36);
            $table->foreignId('subscription_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();

            // plan snapshot
            $table->foreignId('plan_id')
                ->nullable()
                ->constrained()
                ->nullOnDelete();

            // payment data
            $table->decimal('amount', 10, 2);

            $table->string('currency', 10)
                ->default('BOB');

            $table->enum('billing_cycle', [
                'monthly',
                'yearly'
            ])->default('monthly');

            // payment gateway
            $table->enum('method', [
                'qr',
                'card',
                'paypal',
                'bank_transfer',
                'cash'
            ])->nullable();

            // external transaction id
            $table->string('reference')->nullable();

            // status
            $table->enum('status', [
                'pending',
                'paid',
                'failed',
                'refunded',
                'cancelled'
            ])->default('pending');

            // optional proof
            $table->string('receipt')->nullable();

            // metadata
            $table->json('meta')->nullable();

            // payment date
            $table->timestamp('paid_at')->nullable();

            $table->timestamps();

            $table->foreign('tenant_id')
                ->references('id')
                ->on('tenants')
                ->cascadeOnDelete();

            $table->index([
                'tenant_id',
                'status',
            ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
