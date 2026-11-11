<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Log>
 */
class LogFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Log::class;

    public function definition()
    {
        return [
            'user' => $this->faker->userName,
            'acction' => $this->faker->sentence(5),
            'device' => $this->faker->sentence(1),
            'ip' => $this->faker->sentence(1),
        ];
    }
}
