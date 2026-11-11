<?php

namespace Database\Seeders\Tenant;

use Illuminate\Database\Seeder;
//use Database\Seeders\UserSeeder;
//use Database\Seeders\SettingSeeder;
//use Database\Seeders\CategorySeeder;

class TenantDatabaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->call([
            DefaultTenantCatalogSeeder::class,
        ]);
    }
}
