<?php

namespace Database\Seeders;

use App\Models\Configuration;
use Illuminate\Database\Seeder;

class ConfigurationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        Configuration::updateOrCreate(
            ['id' => 1],
            [
                'name' => 'Inventarya',
                'description' => 'La plataforma líder para gestión de inventarios, almacenes múltiples y punto de venta ágil en tiempo real.',
                'phone' => '+591 67239563',
                'email' => 'ventas@inventarya.com',
                'logo' => null,
                'favicon' => null,
                'about_us' => 'Inventarya nace para simplificar y digitalizar el control operativo de negocios comerciales, mayoristas y retail. Nuestra plataforma permite conectar inventarios de almacén central con múltiples puntos de venta en tiempo real, garantizando trazabilidad completa y cero pérdidas por descontrol de stock.',
                'privacy' => 'En Inventarya nos comprometemos a salvaguardar la confidencialidad y seguridad de todos los datos comerciales y de clientes ingresados en la plataforma. Empleamos cifrado de grado bancario y arquitecturas aisladas por tenant para asegurar que tu información pertenezca exclusivamente a tu empresa.',
                'terms' => 'Al utilizar la plataforma Inventarya, el usuario acepta las condiciones de servicio, políticas de suscripción y límites correspondientes al plan contratado. Ofrecemos garantía de disponibilidad del 99.9%, soporte técnico continuo y respaldos automáticos.',
            ]
        );
    }
}
