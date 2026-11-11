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
        Schema::create('siat_legends', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('activity_code', 50);
            $table->text('description');
            $table->timestamps();

            $table->index('activity_code', 'siat_legends_activity_code_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('siat_legends');
    }
};
