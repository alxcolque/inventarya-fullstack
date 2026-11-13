<?php

namespace Database\Seeders;

use App\Models\BusinessType;
use App\Models\BusinessTypeField;
use Illuminate\Database\Seeder;

/**
 * Initial business types and their product fields (central database).
 *
 * Idempotent: types are matched by slug and fields by (type, key). Existing
 * rows are never overwritten, so edits made from the admin panel survive a
 * re-run; only missing rows are created.
 *
 * Deliberately excluded (they are per-unit / per-lot data, not general product
 * attributes): stock quantities, lot expiry dates, lot costs, sizes with their
 * own stock and IMEI numbers of individual units.
 */
class BusinessTypeSeeder extends Seeder
{
    private const T = BusinessTypeField::TYPE_TEXT;

    private const TA = BusinessTypeField::TYPE_TEXTAREA;

    private const B = BusinessTypeField::TYPE_BOOLEAN;

    private const S = BusinessTypeField::TYPE_SELECT;

    public function run(): void
    {
        foreach ($this->definitions() as $definition) {
            $type = BusinessType::query()->firstOrCreate(
                ['slug' => $definition['slug']],
                [
                    'name' => $definition['name'],
                    'description' => $definition['description'],
                    'is_active' => true,
                ],
            );

            foreach ($definition['fields'] as $index => $field) {
                BusinessTypeField::query()->firstOrCreate(
                    ['business_type_id' => $type->id, 'key' => $field['key']],
                    [
                        'label' => $field['label'],
                        'type' => $field['type'],
                        'is_required' => $field['required'] ?? false,
                        'is_active' => true,
                        'options' => $field['options'] ?? null,
                        'validation' => $field['validation'] ?? null,
                        'sort_order' => $index + 1,
                    ],
                );
            }
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function definitions(): array
    {
        $ram = ['2 GB', '3 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB', '32 GB', '64 GB'];
        $storage = ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB'];

        return [
            [
                'slug' => 'pharmacy',
                'name' => 'Farmacia',
                'description' => 'Medicamentos y productos de salud.',
                'fields' => [
                    ['key' => 'active_ingredient', 'label' => 'Principio activo', 'type' => self::T, 'required' => true, 'validation' => ['max_length' => 150]],
                    ['key' => 'concentration', 'label' => 'Concentración', 'type' => self::T, 'validation' => ['max_length' => 60]],
                    ['key' => 'presentation', 'label' => 'Presentación', 'type' => self::S, 'options' => ['Tableta', 'Cápsula', 'Jarabe', 'Suspensión', 'Ampolla', 'Crema', 'Gotas', 'Otro']],
                    ['key' => 'health_registry', 'label' => 'Registro sanitario', 'type' => self::T, 'validation' => ['max_length' => 60]],
                    ['key' => 'requires_prescription', 'label' => 'Requiere receta', 'type' => self::B],
                ],
            ],
            [
                'slug' => 'minimarket',
                'name' => 'Minimarket',
                'description' => 'Abarrotes, bebidas y productos de consumo masivo.',
                'fields' => [
                    ['key' => 'net_content', 'label' => 'Contenido neto', 'type' => self::T, 'validation' => ['max_length' => 60]],
                    ['key' => 'package_type', 'label' => 'Tipo de envase', 'type' => self::S, 'options' => ['Botella', 'Lata', 'Caja', 'Bolsa', 'Frasco', 'Sachet', 'Otro']],
                    ['key' => 'flavor', 'label' => 'Sabor', 'type' => self::T, 'validation' => ['max_length' => 60]],
                    ['key' => 'conservation', 'label' => 'Conservación', 'type' => self::S, 'options' => ['Ambiente', 'Refrigerado', 'Congelado']],
                ],
            ],
            [
                'slug' => 'hardware',
                'name' => 'Ferretería',
                'description' => 'Herramientas, materiales de construcción y suministros.',
                'fields' => [
                    ['key' => 'material', 'label' => 'Material', 'type' => self::T, 'validation' => ['max_length' => 100]],
                    ['key' => 'diameter', 'label' => 'Diámetro', 'type' => self::T, 'validation' => ['max_length' => 60]],
                    ['key' => 'length', 'label' => 'Longitud', 'type' => self::T, 'validation' => ['max_length' => 60]],
                    ['key' => 'technical_spec', 'label' => 'Especificación técnica', 'type' => self::TA],
                ],
            ],
            [
                'slug' => 'clothing',
                'name' => 'Tienda de ropa',
                'description' => 'Prendas de vestir y accesorios.',
                'fields' => [
                    ['key' => 'commercial_gender', 'label' => 'Género comercial', 'type' => self::S, 'options' => ['Hombre', 'Mujer', 'Unisex', 'Niño', 'Niña']],
                    ['key' => 'material', 'label' => 'Material', 'type' => self::T, 'validation' => ['max_length' => 100]],
                    ['key' => 'season', 'label' => 'Temporada', 'type' => self::S, 'options' => ['Primavera', 'Verano', 'Otoño', 'Invierno', 'Todo el año']],
                    ['key' => 'style', 'label' => 'Estilo', 'type' => self::T, 'validation' => ['max_length' => 100]],
                ],
            ],
            [
                'slug' => 'shoes',
                'name' => 'Tienda de zapatos',
                'description' => 'Calzado para todas las ocasiones.',
                'fields' => [
                    ['key' => 'shoe_type', 'label' => 'Tipo de calzado', 'type' => self::S, 'options' => ['Deportivo', 'Casual', 'Formal', 'Sandalia', 'Bota', 'Escolar', 'Otro']],
                    ['key' => 'outer_material', 'label' => 'Material exterior', 'type' => self::T, 'validation' => ['max_length' => 100]],
                    ['key' => 'sole_type', 'label' => 'Tipo de suela', 'type' => self::T, 'validation' => ['max_length' => 100]],
                ],
            ],
            [
                'slug' => 'phones',
                'name' => 'Tienda de celulares',
                'description' => 'Teléfonos móviles y accesorios.',
                'fields' => [
                    ['key' => 'model', 'label' => 'Modelo', 'type' => self::T, 'required' => true, 'validation' => ['max_length' => 100]],
                    ['key' => 'ram', 'label' => 'RAM', 'type' => self::S, 'options' => array_slice($ram, 0, 7)],
                    ['key' => 'storage', 'label' => 'Almacenamiento', 'type' => self::S, 'options' => array_slice($storage, 0, 6)],
                    ['key' => 'connectivity', 'label' => 'Conectividad', 'type' => self::S, 'options' => ['4G', '5G', '4G/5G', 'Wi-Fi']],
                ],
            ],
            [
                'slug' => 'computers',
                'name' => 'Tienda de computadoras',
                'description' => 'Computadoras, componentes y periféricos.',
                'fields' => [
                    ['key' => 'processor', 'label' => 'Procesador', 'type' => self::T, 'validation' => ['max_length' => 100]],
                    ['key' => 'ram', 'label' => 'RAM', 'type' => self::S, 'options' => array_slice($ram, 2)],
                    ['key' => 'storage', 'label' => 'Almacenamiento', 'type' => self::S, 'options' => array_slice($storage, 3)],
                    ['key' => 'storage_type', 'label' => 'Tipo de almacenamiento', 'type' => self::S, 'options' => ['HDD', 'SSD', 'NVMe', 'Híbrido']],
                    ['key' => 'operating_system', 'label' => 'Sistema operativo', 'type' => self::S, 'options' => ['Windows 11', 'Windows 10', 'macOS', 'Linux', 'ChromeOS', 'Sin sistema operativo']],
                ],
            ],
        ];
    }
}

