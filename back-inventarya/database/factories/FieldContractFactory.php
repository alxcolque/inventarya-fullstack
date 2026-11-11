<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\FieldContract>
 */
class FieldContractFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\FieldContract::class;

    public function definition()
    {
        $field = \App\Models\Field::inRandomOrder()->first();
        $contract = \App\Models\Contract::inRandomOrder()->first();

        return [
            'field_id' => $field->id,
            'contract_id' => $contract->id,
        ];
    }
}
