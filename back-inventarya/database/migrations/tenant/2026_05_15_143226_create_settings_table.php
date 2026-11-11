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
        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('business_name');
            $table->string('logo')->nullable();
            $table->string('favicon')->nullable();

            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();

            $table->string('theme')->default('light');
            $table->string('primary_color')->nullable();

            $table->text('terms')->nullable();
            $table->text('policy')->nullable();

            $table->string('currency')->default('BOB');
            $table->string('timezone')->default('America/La_Paz');

            $table->json('social')->nullable();
            //Sections enabled in frontend
            $table->boolean('enable_customers')->default(false);
            $table->boolean('enable_suppliers')->default(false);
            $table->boolean('enable_locations')->default(false);

            // Facturación electrónica (SIAT / SIN)
            $table->boolean('electronic_invoicing_enabled')->default(false);
            $table->string('tax_nit', 30)->nullable();
            $table->string('tax_business_name', 200)->nullable();
            $table->smallInteger('siat_environment')->nullable();
            $table->smallInteger('siat_modality')->nullable();
            $table->string('siat_system_code')->nullable();
            $table->text('siat_api_token')->nullable();
            $table->text('siat_certificate_path')->nullable();
            $table->text('siat_certificate_password')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settings');
    }
};
