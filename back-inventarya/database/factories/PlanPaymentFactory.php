<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\PlanPayment>
 */
class PlanPaymentFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\PlanPayment::class;

    public function definition()
    {
        $contract = \App\Models\Contract::inRandomOrder()->first();

        return [
            'contract_id' => $contract->id,
            'amount_paid' => $this->faker->randomFloat(2, 50, 500),
            'receipt' => $this->faker->imageUrl(200, 200, 'receipt'),
            'status' => $this->faker->randomElement(['activo', 'inactivo']),
        ];
    }
}
