<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Carousel>
 */
class CarouselFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Carousel::class;

    public function definition()
    {
        return [
            'title' => $this->faker->sentence(3),
            'link' => $this->faker->url,
            'description' => $this->faker->sentence(10),
            'visible_btn' => $this->faker->boolean,
            'title_btn' => $this->faker->word,
            'color_btn' => $this->faker->safeColorName,
            'position_btn' => $this->faker->randomElement(['left', 'right', 'center']),
            'image' => $this->faker->imageUrl(800, 600, 'abstract'),
            'display_order' => $this->faker->numberBetween(1, 10),
            'status' => $this->faker->randomElement(['active', 'inactive']),
        ];
    }
}
