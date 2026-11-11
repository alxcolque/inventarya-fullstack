<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Score>
 */
class ScoreFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Score::class;

    public function definition()
    {
        $field = \App\Models\Field::inRandomOrder()->first();
        $user = \App\Models\User::inRandomOrder()->first();

        return [
            'field_id' => $field->id,
            'user_id' => $user->id,
            'star_rating' => $this->faker->numberBetween(1, 5),
            'comments' => $this->faker->sentence,
            'status' => $this->faker->randomElement(['activo', 'inactivo']),
        ];
    }
}
