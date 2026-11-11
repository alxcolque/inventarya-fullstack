<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PaymentMethod>
 */
class PaymentMethodFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\PaymentMethod::class;

    public function definition()
    {
        $field = \App\Models\Field::inRandomOrder()->first();

        return [
            'field_id' => $field->id,
            'name' => $this->faker->word,
            'link_qr' => $this->faker->imageUrl(640, 480, 'qrcode'),
            'account_number' => $this->faker->bankAccountNumber,
            'status' => $this->faker->randomElement(['pendiente', 'activo', 'inactivo']),
        ];
    }
}
