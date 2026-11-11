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
        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();

            $table->string('name', 100);
            $table->string('slug', 100)->unique()->nullable();
            $table->string('address')->nullable();
            $table->string('location', 150)->nullable(); //coordinates (latitude, longitude)
            $table->string('phone', 20)->nullable();
            $table->string('front_image', 255)->nullable();
            $table->string('front_image_key', 255)->nullable();
            $table->boolean('is_active')->default(true);

            // NUEVOS CAMPOS PARA ADMINISTRAR LA API COMPARTIDA
            $table->boolean('api_status')->default(false); // true = Habilitado, false = Deshabilitado
            $table->string('api_key')->nullable()->unique(); // El identificador público de la API
            $table->string('api_secret')->nullable(); // El secreto de acceso (Guardar como HASH por seguridad)
            // show / hide sections in cart
            $table->boolean('enable_customers')->default(false);
            $table->boolean('enable_payment')->default(false);
            $table->boolean('enable_observations')->default(false);
            $table->boolean('enable_discount')->default(false);

            // Facturación electrónica (SIAT)
            $table->boolean('enable_electronic_invoicing')->default(false);
            $table->integer('sin_branch_code')->nullable();
            $table->integer('sin_point_of_sale_code')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stores');
    }
};
