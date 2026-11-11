<?php

namespace App\Http\Requests;

use App\Rules\PublicImage;
use Illuminate\Foundation\Http\FormRequest;

class BrandRequest extends FormRequest
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
        if ($this->isMethod('post')) {
            return [
                'name' => 'required|string|max:255|unique:brands,name',
                'image' => ['nullable', new PublicImage(2048)],
            ];
        } else {
            return [
                'name' => 'required|string|max:255',
                'image' => ['nullable', new PublicImage(2048)],
            ];
        }
    }

    public function messages()
    {
        return [
            'name.required' => 'El nombre es requerido',
            'name.string' => 'El nombre debe ser una cadena de texto',
            'name.max' => 'El nombre debe tener máximo 255 caracteres',
            'image.image' => 'La imagen debe ser una imagen',
            'image.mimes' => 'La imagen debe ser una imagen',
            'image.max' => 'La imagen debe tener máximo 2048 caracteres',
        ];
    }
}