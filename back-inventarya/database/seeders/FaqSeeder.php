<?php

namespace Database\Seeders;

use App\Models\Faq;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class FaqSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('faqs')->truncate();

        $faqs = [
            [
                'question' => '¿Qué es Inventarya y cómo ayuda a mi negocio?',
                'answer' => 'Inventarya es un sistema integral de control de inventarios y punto de venta (POS) en la nube. Te permite administrar productos, entradas, salidas, traslados entre almacenes y ventas en múltiples sucursales con sincronización inmediata y reportes en tiempo real.',
                'category' => 'VARIOS',
                'sort_order' => 1,
                'is_published' => true,
            ],
            [
                'question' => '¿Puedo gestionar múltiples tiendas y almacenes?',
                'answer' => '¡Sí! Dependiendo de tu plan, puedes crear múltiples tiendas y almacenes centrales. Los productos pueden trasladarse entre almacenes y tiendas manteniendo un kardex detallado de cada movimiento.',
                'category' => 'Funcionalidades',
                'sort_order' => 2,
                'is_published' => true,
            ],
            [
                'question' => '¿El sistema funciona con lectores de códigos de barra e impresoras térmicas?',
                'answer' => 'Totalmente. El Punto de Venta (POS) es compatible con lectores de código de barras USB y Bluetooth, así como con impresoras térmicas de tickets (58mm y 80mm) para emitir notas de venta o facturas al instante.',
                'category' => 'Punto de Venta',
                'sort_order' => 3,
                'is_published' => true,
            ],
            [
                'question' => '¿Cómo funciona la prueba gratuita (Trial)?',
                'answer' => 'Todos nuestros planes incluyen un periodo de prueba gratis (de 7 a 30 días según el plan) con acceso completo a las funciones. No necesitas tarjeta de crédito para comenzar; te registras y comienzas a gestionar tu stock de inmediato.',
                'category' => 'Planes y Facturación',
                'sort_order' => 4,
                'is_published' => true,
            ],
            [
                'question' => '¿Puedo restringir qué ven mis vendedores y cajeros?',
                'answer' => 'Sí, el sistema cuenta con control de roles (Propietario, Administrador y Vendedor/Staff). Los vendedores solo tienen acceso a la interfaz de Punto de Venta de su sucursal asignada, protegiendo tus costos, compras y reportes financieros.',
                'category' => 'Seguridad y Permisos',
                'sort_order' => 5,
                'is_published' => true,
            ],
            [
                'question' => '¿Mis datos están seguros y respaldados?',
                'answer' => 'Implementamos una arquitectura multi-tenant donde cada empresa cuenta con aislamiento de datos, respaldos periódicos automáticos y cifrado SSL en todas las comunicaciones.',
                'category' => 'Seguridad y Permisos',
                'sort_order' => 6,
                'is_published' => true,
            ],
            [
                'question' => '¿Cómo puedo contactar a soporte si tengo dudas?',
                'answer' => 'Contamos con soporte prioritario mediante WhatsApp y correo electrónico. Puedes hacer clic en el botón de WhatsApp en cualquier momento para hablar directamente con uno de nuestros especialistas técnicos.',
                'category' => 'Soporte',
                'sort_order' => 7,
                'is_published' => true,
            ],
        ];

        foreach ($faqs as $faq) {
            Faq::create($faq);
        }
    }
}
