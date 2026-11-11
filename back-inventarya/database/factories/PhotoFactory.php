<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Photo>
 */
class PhotoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Photo::class;

    public function definition()
    {
        $field = \App\Models\Field::inRandomOrder()->first();

        return [
            'field_id' => $field->id,
            'view_order' => $this->faker->numberBetween(1, 10),
            'path' => $this->faker->imageUrl(),
        ];
    }
}
