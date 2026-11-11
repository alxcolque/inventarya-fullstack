<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class InventoryStoreRequest extends FormRequest
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
        if ($this->isMethod('PUT') || $this->isMethod('PATCH')) {
            return [
                'product_id'      => 'sometimes|required|exists:products,id',
                'store_id'        => 'sometimes|required|exists:stores,id',
                'quantity'        => 'sometimes|required|numeric|min:0',
                'stock_quantity'  => 'sometimes|required|numeric|min:0',
                'price'           => 'sometimes|required|numeric|min:0',
                'sale_price'      => 'sometimes|required|numeric|min:0',
                'unit'            => 'sometimes|required|string|max:255',
                'min_stock'       => 'nullable|numeric|min:0',
                'expiration_date' => 'nullable|date',
                'location_id'     => 'nullable|exists:locations,id',
                'metadata'        => 'nullable',
            ];
        }

        return [
            'product_id'      => 'required|exists:products,id',
            'store_id'        => 'required|exists:stores,id',
            'quantity'        => 'required|numeric|min:0.001',
            'stock_quantity'  => 'sometimes|numeric|min:0',
            'unit'            => 'required|string|max:255',
            'price'           => 'required|numeric|min:0',
            'sale_price'      => 'sometimes|numeric|min:0',
            'min_stock'       => 'nullable|numeric|min:0',
            'expiration_date' => 'nullable|date',
            'location_id'     => 'nullable|exists:locations,id',
            'metadata'        => 'nullable',
        ];
    }

    public function messages()
    {
        return [
            'product_id.required' => 'El producto es requerido',
            'product_id.exists' => 'El producto no existe',
            'store_id.required' => 'La tienda es requerida',
            'store_id.exists' => 'La tienda no existe',
            'quantity.required' => 'La cantidad es requerida',
            'quantity.numeric' => 'La cantidad debe ser un número válido',
            'quantity.min' => 'La cantidad debe ser mayor a 0',
            'price.required' => 'El precio es requerido',
            'price.numeric' => 'El precio debe ser un número',
            'price.min' => 'El precio debe ser mayor o igual a 0',
            'restock_date.required' => 'La fecha de restock es requerida',
            'restock_date.date' => 'La fecha de restock debe ser una fecha válida',
            'stock_quantity.required' => 'La cantidad de stock es requerida',
            'stock_quantity.numeric' => 'La cantidad de stock debe ser un número válido',
            'stock_quantity.min' => 'La cantidad de stock debe ser mayor o igual a 0',
            'unit.required' => 'La unidad es requerida',
            'unit.string' => 'La unidad debe ser una cadena de texto',
            'unit.max' => 'La unidad debe tener máximo 255 caracteres',
            'sale_price.required' => 'El precio de venta es requerido',
            'sale_price.numeric' => 'El precio de venta debe ser un número',
            'sale_price.min' => 'El precio de venta debe ser mayor o igual a 0',
        ];
    }
}
