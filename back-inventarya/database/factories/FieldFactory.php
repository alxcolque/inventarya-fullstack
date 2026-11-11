<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Field>
 */
class FieldFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Field::class;

    public function definition()
    {
        return [
            'category_id' => \App\Models\Category::factory(),
            'user_id' => \App\Models\User::factory(),
            'name' => $this->faker->company,
            'slug' => Str::slug($this->faker->company, '-'),
            'nit_ci' => $this->faker->numerify('#########'),
            'description' => $this->faker->paragraph,
            'location' => $this->faker->city,
            'address' => $this->faker->address,
            'contact' => $this->faker->phoneNumber,
            'simple_schedule' => $this->faker->boolean,
            'simple_amount' => $this->faker->randomFloat(2, 10, 100),
            'verified' => $this->faker->boolean,
            'status' => $this->faker->randomElement(['activo', 'inactivo']),

            'image' => $this->faker->imageUrl(),
        ];
    }
}
