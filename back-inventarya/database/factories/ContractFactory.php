<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Contract>
 */
class ContractFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Contract::class;

    public function definition()
    {
        $plan = \App\Models\Plan::inRandomOrder()->first();
        $user = \App\Models\User::inRandomOrder()->first();

        return [
            'plan_id' => $plan->id,
            'user_id' => $user->id,
            'start_date' => $this->faker->dateTimeBetween('-1 year', 'now'),
            'end_date' => $this->faker->dateTimeBetween('now', '+1 year'),
            'amount' => $this->faker->randomFloat(2, 100, 1000),
        ];
    }
}
