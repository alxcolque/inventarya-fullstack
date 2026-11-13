<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BusinessTypeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isUpdate = $this->isMethod('put') || $this->isMethod('patch');
        $presence = $isUpdate ? 'sometimes' : 'required';

        return [
            'name' => [$presence, 'string', 'max:100'],
            'slug' => [
                'nullable',
                'string',
                'max:100',
                'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('central.business_types', 'slug')->ignore($this->route('business_type')),
            ],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nombre',
            'slug' => 'slug',
            'description' => 'descripción',
            'is_active' => 'estado',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre del tipo de negocio es obligatorio.',
            'name.max' => 'El nombre no debe superar los :max caracteres.',
            'slug.unique' => 'Ya existe un tipo de negocio con ese slug.',
            'slug.regex' => 'El slug solo admite minúsculas, números y guiones.',
        ];
    }
}

