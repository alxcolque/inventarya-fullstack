<?php

namespace App\Http\Requests;

use App\Rules\PublicImage;
use Illuminate\Foundation\Http\FormRequest;

class StoreRequest extends FormRequest
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
            'name' => 'required|string|max:255',
            'location' => 'nullable|string|max:255',
            'phone' => 'required|string|max:255',
            'address' => 'required|string|max:255',
            'front_image' => ['nullable', new PublicImage(5120, true, true, true)],
            'is_active' => 'nullable|boolean',
            'enable_customers' => 'nullable|boolean',
            'enable_payment' => 'nullable|boolean',
            'enable_observations' => 'nullable|boolean',
            'enable_discount' => 'nullable|boolean',
            'enable_electronic_invoicing' => 'nullable|boolean',
            'sin_branch_code' => 'nullable|integer|min:0',
            'sin_point_of_sale_code' => 'nullable|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es requerido',
            'location.required' => 'La dirección es requerida',
            'phone.required' => 'El teléfono es requerido',
            'address.required' => 'La dirección es requerida',
            /* 'front_image.required' => 'La imagen frontal es requerida',
            'front_image.image' => 'La imagen frontal debe ser una imagen',
            'front_image.mimes' => 'La imagen frontal debe ser una imagen válida',
            'front_image.max' => 'La imagen frontal debe ser una imagen válida', */
        ];
    }
}
