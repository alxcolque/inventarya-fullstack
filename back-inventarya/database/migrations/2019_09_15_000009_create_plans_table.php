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
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->decimal('price', 10, 2)->default(0);
            $table->decimal('yearly_price', 10, 2)->default(0);
            $table->integer('max_users')->nullable();
            $table->integer('max_stores')->nullable();
            $table->integer('max_products')->nullable();
            $table->jsonb('features')->nullable();
            $table->boolean('custom_domain')->default(false);
            $table->boolean('multi_store')->default(false);
            $table->boolean('reports')->default(true);
            $table->integer('trial_days')->default(7);
            $table->string('status')->default('active');
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};