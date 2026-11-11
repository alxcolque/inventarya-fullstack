<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Assistance>
 */
class AssistanceFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Assistance::class;

    public function definition()
    {
        $title = $this->faker->sentence(4);
        return [
            'title' => $title,
            'slug' => Str::slug($title, '-'),
            'type' => $this->faker->randomElement(['type1', 'type2', 'type3']),
            'extract' => $this->faker->sentence(15),
            'body' => $this->faker->paragraph(3),
        ];
    }
}
