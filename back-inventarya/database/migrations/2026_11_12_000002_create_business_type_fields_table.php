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
        Schema::create('business_type_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('business_type_id')->constrained('business_types')->cascadeOnDelete();
            $table->string('key', 100);
            $table->string('label', 150);
            $table->string('type', 30);
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->jsonb('options')->nullable();
            $table->jsonb('validation')->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['business_type_id', 'key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('business_type_fields');
    }
};

