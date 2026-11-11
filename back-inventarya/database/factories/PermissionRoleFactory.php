<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PermissionRole>
 */
class PermissionRoleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $permission = \App\Models\Permission::inRandomOrder()->first();
        $role = \App\Models\Role::inRandomOrder()->first();

        return [
            'permission_id' => $permission->id,
            'role_id' => $role->id,
        ];
    }
}
