<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaleRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'id' => 'nullable|uuid',
            'cash_register_session_id' => 'nullable|uuid',
            'user_id' => 'nullable',
            'seller_id' => 'nullable',
            'total' => 'nullable|numeric|min:0',
            'status' => 'required|string|max:255',
            'payment_method' => 'nullable|string',
            'store_id' => 'required',
            'discount' => 'nullable|numeric|min:0',
            'observation' => 'nullable|string|max:1000',
            'amount_received' => 'nullable|numeric|min:0',
            'change' => 'nullable|numeric|min:0',
            'payments' => 'nullable|array',
            'payments.*.payment_method' => 'required_with:payments|string|max:50',
            'payments.*.amount' => 'required_with:payments|numeric|min:0.01',
            'payments.*.amount_received' => 'nullable|numeric|min:0',
            'payments.*.change_amount' => 'nullable|numeric|min:0',
            'payments.*.reference' => 'nullable|string|max:255',
        ];
    }

    public function messages()
    {
        return [
            'customer_id.required' => 'El cliente es requerido',
            'customer_id.exists' => 'El cliente no existe',
            'user_id.required' => 'El vendedor es requerido',
            'user_id.exists' => 'El vendedor no existe',
            'order_date.required' => 'La fecha de la orden es requerida',
            'order_date.date' => 'La fecha de la orden debe ser una fecha válida',
            'total.required' => 'El total es requerido',
            'total.numeric' => 'El total debe ser un número válido',
            'total.min' => 'El total debe ser mayor o igual a 0',
            'status.required' => 'El estado es requerido',
            'status.string' => 'El estado debe ser una cadena de texto',
            'status.max' => 'El estado debe tener máximo 255 caracteres',
        ];
    }
}
