<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CreateDomainsTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            throw new RuntimeException('The domains schema requires PostgreSQL.');
        }

        Schema::create('domains', function (Blueprint $table) {
            $table->id();

            $table->string('domain')->unique();

            $table->string('tenant_id')->index();

            $table->boolean('is_primary')->default(true);

            $table->enum('type', [
                'subdomain',
                'custom',
            ])->default('subdomain');

            $table->enum('status', [
                'pending',
                'active',
                'suspended',
                'expired',
            ])->default('pending');

            $table->timestamp('verified_at')->nullable();

            $table->timestamps();
        });

        DB::statement(
            'CREATE UNIQUE INDEX domains_one_primary_per_tenant '
            .'ON domains (tenant_id) WHERE is_primary = true'
        );

        DB::statement(
            'CREATE UNIQUE INDEX domains_domain_normalized_unique '
            .'ON domains (lower(domain))'
        );
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('domains');
    }
}
