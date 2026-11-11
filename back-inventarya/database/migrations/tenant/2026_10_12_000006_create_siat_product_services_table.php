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
        Schema::create('siat_product_services', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('activity_code', 50);
            $table->bigInteger('sin_product_code');
            $table->text('description');
            $table->string('nandina', 50)->nullable();
            $table->timestamps();

            $table->unique(['activity_code', 'sin_product_code'], 'siat_prod_serv_activity_code_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('siat_product_services');
    }
};
