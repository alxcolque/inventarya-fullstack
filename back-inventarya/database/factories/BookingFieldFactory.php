<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\BookingField>
 */
class BookingFieldFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\BookingField::class;

    public function definition()
    {
        $booking = \App\Models\Booking::inRandomOrder()->first();
        $field = \App\Models\Field::inRandomOrder()->first();

        return [
            'booking_id' => $booking->id,
            'field_id' => $field->id,
            'time' => $this->faker->time(),
            'date' => $this->faker->date(),
            'price' => $this->faker->randomFloat(2, 0, 100),
        ];
    }
}
