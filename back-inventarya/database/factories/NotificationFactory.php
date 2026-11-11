<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Notification>
 */
class NotificationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Notification::class;

    public function definition()
    {
        $report = \App\Models\Report::inRandomOrder()->first();

        return [
            'title' => $this->faker->sentence(4),
            'type' => $this->faker->randomElement(['system', 'user', 'alert']),
            'extract' => $this->faker->sentence(15),
            'body' => $this->faker->paragraph(3),
            'report_id' => $report->id
        ];
    }
}
