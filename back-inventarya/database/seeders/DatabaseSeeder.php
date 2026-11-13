<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {

        $this->call([
            PlanSeeder::class,
            BusinessTypeSeeder::class,
            ConfigurationSeeder::class,
            FaqSeeder::class,
            // UserSeeder::class, // Users table is in the tenant schema
        ]);

        // Security: the privileged account is intentionally not provisioned by
        // the default seed flow. Run SuperadminSeeder explicitly with the three
        // required SUPERADMIN_* environment variables during a controlled setup.
        /*
        \App\Models\Setting::factory()->count(10)->create();
        \App\Models\Carousel::factory()->count(10)->create();
        \App\Models\Assistance::factory()->count(10)->create();
        \App\Models\Report::factory()->count(10)->create();
        \App\Models\Notification::factory()->count(10)->create();
        \App\Models\Log::factory()->count(10)->create();
        \App\Models\Plan::factory()->count(10)->create();
        \App\Models\Category::factory()->count(10)->create();
        \App\Models\Field::factory()->count(10)->create();
        \App\Models\Contract::factory()->count(10)->create();
        \App\Models\PlanPayment::factory()->count(10)->create();
        \App\Models\Schedule::factory()->count(10)->create();
        \App\Models\Maintenance::factory()->count(10)->create();
        \App\Models\Favorite::factory()->count(10)->create();
        \App\Models\Score::factory()->count(10)->create();
        \App\Models\FieldContract::factory()->count(10)->create();
        \App\Models\PaymentMethod::factory()->count(10)->create();
        \App\Models\PreRegistration::factory()->count(10)->create();
        \App\Models\Booking::factory()->count(10)->create();
        \App\Models\BookingField::factory()->count(10)->create();
        \App\Models\Payment::factory()->count(10)->create();
        \App\Models\Photo::factory()->count(30)->create();
        */
    }
}
