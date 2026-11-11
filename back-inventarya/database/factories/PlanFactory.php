<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Plan>
 */
class PlanFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Plan::class;

    public function definition()
    {
        $name = $this->faker->word;
        return [
            'name' => $name,
            'slug' => Str::slug($name, '-'),
            'extract' => $this->faker->sentence(1),
            'price' => $this->faker->randomFloat(2, 0, 100),
            'promo' => $this->faker->randomFloat(2, 0, 100),
            'description' => $this->faker->text(400),
            'quantity' => $this->faker->numberBetween(1, 100),
            'color' => $this->faker->safeColorName,
        ];
    }
}
