<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SupplierRequest extends FormRequest
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
        /* if is create */
        if ($this->isMethod('post')) {
            return [
                'cinit' => 'required|string|max:255|unique:suppliers,cinit',
                'name' => 'required|string|max:255',
                /* 'email' => 'required|email|unique:suppliers,email',
                'phone' => 'required|string|max:255',
                'address' => 'required|string|max:255', */
            ];
        } else {
            return [
                'cinit' => 'required|string',
                'name' => 'required|string|max:255',
                'email' => 'required|email',
                'phone' => 'required|string|max:255',
                'address' => 'required|string|max:255',
            ];
        }
    }

    public function messages()
    {
        return [
            'cinit.required' => 'El código de identificación es requerido',
            'cinit.string' => 'El código de identificación debe ser una cadena de texto',
            'cinit.max' => 'El código de identificación debe tener máximo 255 caracteres',
            'name.required' => 'El nombre es requerido',
            'name.string' => 'El nombre debe ser una cadena de texto',
            'name.max' => 'El nombre debe tener máximo 255 caracteres',
            'email.required' => 'El correo electrónico es requerido',
        ];
    }
}