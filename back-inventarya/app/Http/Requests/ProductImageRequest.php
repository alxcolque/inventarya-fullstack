<?php

namespace App\Http\Requests;

use App\Rules\PublicImage;
use Illuminate\Foundation\Http\FormRequest;

class ProductImageRequest extends FormRequest
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
            'image' => ['required', new PublicImage(2048, false, false)],
            'product_id' => 'required|uuid|exists:products,id',
        ];
    }

    public function messages(): array
    {
        return [
            'image.required' => 'La imagen es requerida',
            'image.image' => 'La imagen debe ser una imagen',
            'image.mimes' => 'La imagen debe ser una imagen válida',
            'image.max' => 'La imagen debe ser una imagen válida',
            'product_id.required' => 'El producto es requerido',
            'product_id.uuid' => 'El identificador del producto debe ser un UUID válido',
            'product_id.exists' => 'El producto no existe',
        ];
    }
}