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
        Schema::create('carousels', function (Blueprint $table) {
            $table->id();
            $table->string('title', 64);
            $table->string('link', 150)->nullable();
            $table->string('description', 255)->nullable();
            $table->boolean('visible_btn')->default(0);
            $table->string('title_btn', 32)->nullable();
            $table->string('color_btn', 64)->nullable();
            $table->string('position_btn', 64)->default('center')->nullable();
            $table->string('image')->nullable();
            $table->string('image_key')->nullable();
            $table->integer('display_order')->nullable();
            $table->string('status', 32)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('carousels');
    }
};
