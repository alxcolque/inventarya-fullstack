<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Role>
 */
class RoleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Role::class;

    public function definition(): array
    {
        $roles = ['Admin', 'Owner', 'Worker', 'Client'];

        return [
            'name' => $this->faker->unique()->randomElement($roles),
        ];
    }
}
