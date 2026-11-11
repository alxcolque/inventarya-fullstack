<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Category>
 */
class CategoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Category::class;

    public function definition()
    {
        $title = $this->faker->words(2, true);
        return [
            'title' => $title,
            'slug' => Str::slug($title, '-'),
            'icon' => $this->faker->imageUrl(150, 150, 'business'),
            'color' => $this->faker->safeColorName,
            'description' => $this->faker->sentence(10),
        ];
    }
}
