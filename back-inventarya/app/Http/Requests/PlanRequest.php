<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $planId = $this->route('plan');

        return [
            'name' => 'required|string|max:100',
            'slug' => [
                'required',
                'string',
                Rule::unique('plans', 'slug')->ignore($planId),
            ],
            'price' => 'numeric',
            'yearly_price' => 'numeric',
            'max_users' => 'nullable|integer',
            'max_stores' => 'nullable|integer',
            'max_products' => 'nullable|integer',
            'features' => 'nullable|array',
            'custom_domain' => 'boolean',
            'multi_store' => 'boolean',
            'reports' => 'boolean',
            'trial_days' => 'integer',
            'status' => 'string|max:50',
            'description' => 'nullable|string',
        ];
    }
}
