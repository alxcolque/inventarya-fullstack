<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\RoleUser>
 */
class RoleUserFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\RoleUser::class;

    public function definition(): array
    {
        $role = \App\Models\Role::inRandomOrder()->first();
        $user = \App\Models\User::inRandomOrder()->first();
        $field = \App\Models\Field::inRandomOrder()->first();

        return [
            'role_id' => $role->id,
            'user_id' => $user->id,
            'field_id' => $field->id,
            'status' => $this->faker->randomElement(['Activo', 'Incativo', 'Eliminado']),
        ];
    }
}
