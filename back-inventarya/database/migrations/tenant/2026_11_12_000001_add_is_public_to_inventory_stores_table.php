<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Default true keeps every existing inventory record publicly visible,
     * exactly as it behaved before this column existed.
     */
    public function up(): void
    {
        Schema::table('inventory_stores', function (Blueprint $table) {
            $table->boolean('is_public')->default(true);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('inventory_stores', function (Blueprint $table) {
            $table->dropColumn('is_public');
        });
    }
};

