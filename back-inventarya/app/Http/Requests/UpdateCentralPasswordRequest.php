<?php

namespace App\Http\Requests;

use App\Models\CentralUser;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class UpdateCentralPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() instanceof CentralUser;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],
            'password' => [
                'required',
                'string',
                'confirmed',
                'different:current_password',
                Password::min(8)->letters()->numbers(),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'current_password.required' => 'Ingresa tu contraseña actual.',
            'password.required' => 'Ingresa la nueva contraseña.',
            'password.confirmed' => 'La confirmación de la contraseña no coincide.',
            'password.different' => 'La nueva contraseña debe ser diferente de la actual.',
        ];
    }
}
