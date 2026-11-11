<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Favorite>
 */
class FavoriteFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Favorite::class;

    public function definition()
    {
        $field = \App\Models\Field::inRandomOrder()->first();
        $user = \App\Models\User::inRandomOrder()->first();

        return [
            'field_id' => $field->id,
            'user_id' => $user->id,
        ];
    }
}
