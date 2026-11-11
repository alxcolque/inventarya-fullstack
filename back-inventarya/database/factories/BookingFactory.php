<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Booking>
 */
class BookingFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Booking::class;

    public function definition()
    {
        $user = \App\Models\User::inRandomOrder()->first();

        return [
            'user_id' => $user->id,
            'num' => $this->faker->randomNumber(3),
            'discount' => $this->faker->randomFloat(2, 0, 100),
            'total' => $this->faker->randomFloat(2, 10, 500),
            'status' => $this->faker->randomElement(['pendiente', 'pagado', 'cancelado']),
        ];
    }
}
