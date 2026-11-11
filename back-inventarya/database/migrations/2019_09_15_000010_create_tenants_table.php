<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTenantsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            /* COMPANY */

            $table->string('name');
            $table->string('slug')->unique();

            $table->enum('status', [
                'pending',
                'trial',
                'active',
                'suspended',
                'unpaid',
                'expired'
            ])->default('pending');

            /* DATABASE */

            $table->string('database');

            // OPTIONAL FUTURE SCALING
            $table->string('database_host')->nullable();
            $table->string('database_port')->nullable();
            $table->string('database_username')->nullable();
            $table->string('database_password')->nullable();

            /* OWNER */

            $table->string('owner_name')->nullable();
            $table->string('owner_email')->nullable();
            $table->string('owner_phone')->nullable();

            /* BRANDING */

            $table->string('logo')->nullable();

            /* METADATA */

            $table->json('data')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
}
