<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PreRegistration>
 */
class PreRegistrationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\PreRegistration::class;

    public function definition()
    {
        $user = \App\Models\User::inRandomOrder()->first();
        $field = \App\Models\Field::inRandomOrder()->first();

        return [
            'user_id' => $user->id,
            'field_id' => $field->id,
            'time' => $this->faker->time(),
            'date' => $this->faker->date(),
            'price' => $this->faker->randomFloat(2, 0, 100),
        ];
    }
}
