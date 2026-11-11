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
        Schema::create('siat_cuis', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('store_id')->constrained('stores')->restrictOnDelete();
            $table->integer('branch_code');
            $table->integer('point_of_sale_code');
            $table->string('cuis', 255);
            $table->timestamp('valid_until');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['store_id', 'branch_code', 'point_of_sale_code', 'is_active'], 'siat_cuis_point_active_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('siat_cuis');
    }
};
