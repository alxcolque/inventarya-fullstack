<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Report>
 */
class ReportFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Report::class;

    public function definition()
    {
        return [
            'report' => $this->faker->sentence(5),
            'content' => $this->faker->sentence(10),
            'reporter' => $this->faker->name,
            'reported' => $this->faker->name,
        ];
    }
}
