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
        Schema::create('siat_payment_mappings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('commercial_method', 50)->unique();
            $table->integer('siat_payment_method_code');
            $table->timestamps();

            $table->index('siat_payment_method_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('siat_payment_mappings');
    }
};
