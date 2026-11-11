<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Setting>
 */
class SettingFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Setting::class;

    public function definition()
    {
        return [
            'name' => $this->faker->word,
            'logo' => $this->faker->imageUrl(128, 128),
            'description' => $this->faker->sentence(20),
            'header' => $this->faker->text,
            'contact' => $this->faker->phoneNumber,
            'support' => $this->faker->email,
            'social' => $this->faker->text,
            'footer' => $this->faker->text,
            'terms' => $this->faker->text,
            'policy' => $this->faker->text,
        ];
    }
}
