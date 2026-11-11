<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $locationId = $this->route('location') ?? $this->route('id');

        return [
            'name' => 'required|string|max:100',
            'parent_id' => [
                'nullable',
                'integer',
                'exists:locations,id',
                function ($attribute, $value, $fail) use ($locationId) {
                    if ($locationId && (int)$value === (int)$locationId) {
                        $fail('Una ubicación no puede ser padre de sí misma.');
                    }
                },
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre de la ubicación es requerido',
            'name.string' => 'El nombre debe ser una cadena de texto',
            'name.max' => 'El nombre no debe exceder los 100 caracteres',
            'parent_id.exists' => 'La ubicación superior seleccionada no existe',
            'parent_id.integer' => 'El identificador de ubicación padre debe ser un número entero',
        ];
    }
}
