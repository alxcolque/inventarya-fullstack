<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CategoryRequest extends FormRequest
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
        $categoryId = $this->route('category') ?? $this->route('id');

        return [
            'name' => ($this->isMethod('PATCH') ? 'sometimes|required' : 'required').'|string|max:100',
            'parent_id' => [
                'nullable',
                'integer',
                'exists:categories,id',
                function ($attribute, $value, $fail) use ($categoryId) {
                    if ($categoryId && (int)$value === (int)$categoryId) {
                        $fail('Una categoría no puede ser padre de sí misma.');
                    }
                },
            ],
            'color' => 'nullable|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre de la categoría es requerido',
            'name.string' => 'El nombre debe ser una cadena de texto',
            'name.max' => 'El nombre no debe exceder los 100 caracteres',
            'parent_id.exists' => 'La categoría superior seleccionada no existe',
            'parent_id.integer' => 'El identificador de categoría padre debe ser un número entero',
            'color.string' => 'El color debe ser una cadena de texto',
            'color.max' => 'El color debe tener máximo 255 caracteres',
        ];
    }
}