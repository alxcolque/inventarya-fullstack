<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class AuthRegisterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|min:4',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:6|max:18',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El campo nombre es requerido',
            'name.min' => 'El nombre es muy corto',
            'email.required' => 'El campo email es requerido',
            'email.email' => 'Ingrese un email correcto',
            'email.unique' => 'Ya se registro este email',
            'password.required' => 'La contrase単a es requerida',
            'password.min' => 'La contrase単a es corta',
            'password.max' => 'La contrase単a es larga',
        ];
    }
}
