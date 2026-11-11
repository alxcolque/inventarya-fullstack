<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tenant_id' => 'required|string|exists:tenants,id',
            'subscription_id' => 'nullable|exists:subscriptions,id',
            'plan_id' => 'nullable|exists:plans,id',
            'amount' => 'required|numeric|min:0',
            'currency' => 'string|max:10',
            'billing_cycle' => 'string|in:monthly,yearly',
            'method' => 'nullable|string|in:qr,card,paypal,bank_transfer,cash',
            'reference' => 'nullable|string|max:255',
            'status' => 'nullable|string|in:pending,paid,failed,refunded,cancelled',
            'receipt' => 'nullable|string|max:255',
            'meta' => 'nullable|array',
            'paid_at' => 'nullable|date',
        ];
    }
}
