<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Payment>
 */
class PaymentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Payment::class;

    public function definition()
    {
        $booking = \App\Models\Booking::inRandomOrder()->first();

        return [
            'booking_id' => $booking->id,
            'amount' => $this->faker->randomFloat(2, 10, 200),
            'payment_proof' => $this->faker->imageUrl(),
        ];
    }
}
