<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tenant_id' => 'required|string|exists:tenants,id',
            'plan_id' => 'required|exists:plans,id',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date',
            'trial_ends_at' => 'nullable|date',
            'cancelled_at' => 'nullable|date',
            'status' => 'string|in:active,inactive,pending,canceled,cancelled,expired,trialing,past_due,suspended',
            'billing_cycle' => 'string|in:monthly,yearly',
            'price' => 'numeric|min:0',
        ];
    }
}
