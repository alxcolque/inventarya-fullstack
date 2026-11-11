<?php

use Illuminate\Database\Migrations\Migration;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Location;
use Illuminate\Support\Str;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Tabla "brands": DESCONOCIDO
        $brand = Brand::whereRaw('LOWER(name) = ?', ['desconocido'])->first();
        if (!$brand) {
            Brand::create([
                'name' => 'DESCONOCIDO',
                'slug' => 'desconocido',
            ]);
        }

        // 2. Tabla "categories": VARIOS
        $category = Category::whereRaw('LOWER(name) = ?', ['varios'])->first();
        if (!$category) {
            Category::create([
                'name' => 'VARIOS',
                'slug' => 'varios',
            ]);
        } else if ($category->name !== 'VARIOS') {
            $category->update(['name' => 'VARIOS']);
        }

        // 3. Tabla "locations": Almacen Central y Tienda
        $locations = ['Almacen Central', 'Tienda'];
        foreach ($locations as $locName) {
            $loc = Location::whereRaw('LOWER(name) = ?', [mb_strtolower($locName, 'UTF-8')])->first();
            if (!$loc) {
                Location::create([
                    'name' => $locName,
                    'slug' => Str::slug($locName),
                    'parent_id' => null,
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No destructivo para no eliminar datos de negocio en rollback
    }
};
