<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Schedule>
 */
class ScheduleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Schedule::class;

    public function definition()
    {
        $field = \App\Models\Field::inRandomOrder()->first();

        return [
            'field_id' => $field->id,
            'name' => $this->faker->word,
            'amount' => $this->faker->randomFloat(2, 50, 200),
            'start_time' => $this->faker->time('H:i'),
            'end_time' => $this->faker->time('H:i'),
        ];
    }
}
