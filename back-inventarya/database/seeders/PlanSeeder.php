<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $plans = [
            [
                'name' => 'Básico',
                'slug' => 'basico',

                'price' => 0,
                'yearly_price' => 0,

                'max_users' => 2,
                'max_stores' => 1,
                'max_products' => 500,

                'features' => json_encode([
                    'inventory' => true,
                    'stock_alerts' => true,
                    'barcode' => true,
                    'notifications' => true,

                    'transfers' => false,
                    'advanced_reports' => false,
                    'api' => false,
                    'audit_logs' => false,
                    'priority_support' => false,
                    'custom_integrations' => false,
                ]),

                'custom_domain' => false,
                'multi_store' => false,
                'reports' => true,

                // Básico es gratuito permanentemente.
                'trial_days' => 0,

                'status' => 'active',

                'description' =>
                    'Plan gratuito para pequeños negocios que están comenzando a gestionar su inventario.',

                'created_at' => $now,
                'updated_at' => $now,
            ],

            [
                'name' => 'Profesional',
                'slug' => 'profesional',

                'price' => 29.99,
                'yearly_price' => 299.99,

                'max_users' => 10,
                'max_stores' => 3,
                'max_products' => 10000,

                'features' => json_encode([
                    'inventory' => true,
                    'stock_alerts' => true,
                    'barcode' => true,
                    'notifications' => true,

                    'transfers' => true,
                    'advanced_reports' => true,
                    'api' => false,
                    'audit_logs' => true,
                    'priority_support' => false,
                    'custom_integrations' => false,
                ]),

                'custom_domain' => true,
                'multi_store' => true,
                'reports' => true,

                'trial_days' => 14,

                'status' => 'active',

                'description' =>
                    'Plan para negocios en crecimiento que necesitan múltiples tiendas, transferencias y reportes avanzados.',

                'created_at' => $now,
                'updated_at' => $now,
            ],

            [
                'name' => 'Empresarial',
                'slug' => 'empresarial',

                'price' => 99.99,
                'yearly_price' => 999.99,

                // NULL = ilimitado
                'max_users' => null,
                'max_stores' => null,
                'max_products' => null,

                'features' => json_encode([
                    'inventory' => true,
                    'stock_alerts' => true,
                    'barcode' => true,
                    'notifications' => true,

                    'transfers' => true,
                    'advanced_reports' => true,
                    'api' => true,
                    'audit_logs' => true,
                    'priority_support' => true,
                    'custom_integrations' => true,
                ]),

                'custom_domain' => true,
                'multi_store' => true,
                'reports' => true,

                'trial_days' => 30,

                'status' => 'active',

                'description' =>
                    'Plan empresarial con capacidades avanzadas, integraciones y recursos sin límites predefinidos.',

                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        DB::table('plans')->upsert(
            $plans,
            ['slug'],
            [
                'name',
                'price',
                'yearly_price',

                'max_users',
                'max_stores',
                'max_products',

                'features',

                'custom_domain',
                'multi_store',
                'reports',

                'trial_days',
                'status',
                'description',

                'updated_at',
            ]
        );
    }
}
