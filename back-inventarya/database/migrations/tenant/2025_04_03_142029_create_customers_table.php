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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();

            $table->string('name', 150);
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('address')->nullable();

            // Identificación
            $table->smallInteger('document_type')->nullable();
            $table->string('document_number', 50)->nullable();
            $table->string('document_complement', 20)->nullable();

            $table->timestamps();

            $table->unique(
                ['document_type', 'document_number', 'document_complement'],
                'customers_document_unique'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
