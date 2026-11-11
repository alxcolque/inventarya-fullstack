<?php

namespace App\Http\Requests;

use App\Rules\PublicImage;
use Illuminate\Foundation\Http\FormRequest;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'        => ($this->isMethod('put') || $this->isMethod('patch')) ? 'sometimes|required|string|max:150' : 'required|string|max:150',
            'category_id' => 'nullable|exists:categories,id',
            'brand_id'    => 'nullable|exists:brands,id',
            'sku' => 'nullable|string|max:100',
            'barcode' => 'nullable|string|max:100',
            'sin_product_code' => 'nullable|string|max:100',
            'sin_activity_code' => 'nullable|string|max:100',
            'sin_unit_code' => 'nullable|integer',
            'description' => 'nullable|string',
            'image' => ['nullable', new PublicImage(2048)],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'       => 'El nombre del producto es obligatorio.',
            'name.string'         => 'El nombre debe ser una cadena de texto.',
            'name.max'            => 'El nombre no debe exceder los 150 caracteres.',
            'category_id.exists'  => 'La categoría seleccionada no existe.',
            'brand_id.exists'     => 'La marca seleccionada no existe.',
            'sku.max'             => 'El SKU no debe exceder los 100 caracteres.',
            'barcode.string'      => 'El código de barras debe ser una cadena de texto.',
            'barcode.max'         => 'El código de barras no debe exceder los 100 caracteres.',
        ];
    }
}
