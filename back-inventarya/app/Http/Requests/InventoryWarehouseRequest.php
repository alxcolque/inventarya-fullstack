<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class InventoryWarehouseRequest extends FormRequest
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
            'product_id'     => 'required|exists:products,id',
            'supplier_id'    => 'nullable|exists:suppliers,id',
            'quantity'       => 'nullable|numeric|min:0',
            'price'          => 'nullable|numeric|min:0',
            'sale_price'     => 'nullable|numeric|min:0',
            'saleprice'      => 'nullable|numeric|min:0',
            'unit'           => 'nullable|string|max:100',
            'stock_quantity' => 'nullable|numeric',
            'min_stock'      => 'nullable|numeric|min:0',
            'location_id'    => 'nullable|exists:locations,id',
            'metadata'       => 'nullable',
        ];
    }

    public function messages()
    {
        return [
            'product_id.required'  => 'El producto es requerido',
            'product_id.exists'    => 'El producto seleccionado no existe',
            'supplier_id.exists'   => 'El proveedor seleccionado no existe',
            'quantity.numeric'     => 'La cantidad debe ser un número válido',
            'quantity.min'         => 'La cantidad debe ser mayor o igual a 0',
            'price.numeric'        => 'El precio debe ser un número válido',
            'price.min'            => 'El precio debe ser mayor o igual a 0',
            'sale_price.numeric'   => 'El precio de venta debe ser un número válido',
            'sale_price.min'       => 'El precio de venta debe ser mayor o igual a 0',
            'saleprice.numeric'    => 'El precio de venta debe ser un número válido',
            'saleprice.min'        => 'El precio de venta debe ser mayor o igual a 0',
            'location_id.exists'   => 'La ubicación seleccionada no existe',
            'unit.max'             => 'La unidad debe tener máximo 100 caracteres',
        ];
    }
}
