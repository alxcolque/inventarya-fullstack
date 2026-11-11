<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CleanCentralDatabase extends Command
{
    protected $signature = 'tenancy:clean-central {--force : Skip confirmation prompt}';
    protected $description = 'Drop tenant-only tables that were accidentally created in central_db';

    /**
     * Tables that belong ONLY in tenant databases, never in central_db.
     */
    protected array $tenantTables = [
        // Auth / Users
        'users',
        'password_reset_tokens',
        'sessions',

        // Tenant-specific domain data
        'notifications',
        'logs',
        'settings',

        // Product catalog
        'categories',
        'sub_categories',
        'brands',
        'products',
        'product_images',

        // Commerce
        'customers',
        'suppliers',
        'sales',
        'sale_details',

        // Store management
        'stores',
        'assignments',
        'inventory_stores',
        'inventory_warehouses',
        'stock_movements',
    ];

    public function handle(): int
    {
        $this->warn('⚠️  This will drop tenant tables from central_db.');
        $this->line('Connection: ' . config('database.default'));
        $this->line('Database:   ' . config('database.connections.' . config('database.default') . '.database'));
        $this->newLine();

        if (!$this->option('force')) {
            if (!$this->confirm('Are you sure you want to drop these tables from central_db?')) {
                $this->info('Aborted.');
                return 0;
            }
        }

        // Ensure we are on the central connection
        $connection = DB::connection('central');

        $dropped = [];
        $skipped = [];

        foreach ($this->tenantTables as $table) {
            if (Schema::connection('central')->hasTable($table)) {
                $this->line("  Dropping: {$table}");
                $connection->statement("DROP TABLE IF EXISTS \"{$table}\" CASCADE");
                $dropped[] = $table;
            } else {
                $skipped[] = $table;
            }
        }

        $this->newLine();
        $this->info('✅ Dropped ' . count($dropped) . ' tenant tables from central_db:');
        foreach ($dropped as $t) {
            $this->line("   - {$t}");
        }

        if (!empty($skipped)) {
            $this->comment('ℹ️  Skipped ' . count($skipped) . ' tables (already absent):');
            foreach ($skipped as $t) {
                $this->line("   - {$t}");
            }
        }

        return 0;
    }
}
