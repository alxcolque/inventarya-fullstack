<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaleDetailRequest extends FormRequest
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
            'sale_id' => 'required|exists:sales,id',
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|numeric|min:0.001',
            'price' => 'required|numeric|min:0',
            'subtotal' => 'required|numeric|min:0',
        ];
    }

    public function messages()
    {
        return [
            'sale_id.required' => 'La venta es requerida',
            'sale_id.exists' => 'La venta no existe',
            'product_id.required' => 'El producto es requerido',
            'product_id.exists' => 'El producto no existe',
            'quantity.required' => 'La cantidad es requerida',
            'quantity.numeric' => 'La cantidad debe ser un número válido',
            'quantity.min' => 'La cantidad debe ser mayor a 0',
            'price.required' => 'El precio es requerido',
            'price.numeric' => 'El precio debe ser un número',
            'price.min' => 'El precio debe ser mayor o igual a 0',
            'subtotal.required' => 'El subtotal es requerido',
            'subtotal.numeric' => 'El subtotal debe ser un número',
            'subtotal.min' => 'El subtotal debe ser mayor o igual a 0',
        ];
    }
}
