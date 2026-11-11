<?php

namespace App\Http\Requests;

use App\Rules\PublicImage;
use Illuminate\Foundation\Http\FormRequest;

class UserRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => is_string($this->email) ? strtolower(trim($this->email)) : $this->email,
            'username' => is_string($this->username) && trim($this->username) !== ''
                ? strtolower(trim($this->username))
                : null,
        ]);
    }

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
                'name' => 'required|string|max:255',
                'username' => 'nullable|string|max:255|unique:users,username',
                'email' => 'required|string|email|max:255|unique:users,email',
                'role' => 'required|string|in:admin,staff',
                'phone' => 'nullable|string|max:255',
                'ci' => 'nullable|string|max:255',
                'avatar' => ['nullable', new PublicImage(2048, true, true, true)],
            ];
        } else {
            $userParam = $this->route('user');
            $id = $userParam instanceof \App\Models\User ? $userParam->id : $userParam;

            return [
                'name' => 'required|string|max:255',
                'username' => 'nullable|string|max:255|unique:users,username,'.$id,
                'email' => 'required|string|email|max:255|unique:users,email,'.$id,
                'phone' => 'nullable|string|max:255',
                'ci' => 'nullable|string|max:255',
                'password' => 'nullable|string|min:6',
                'role' => 'nullable|string|in:owner,admin,staff',
                'status' => 'nullable|string|in:active,inactive',
                'avatar' => ['nullable', new PublicImage(2048, true, true, true)],
            ];
        }
    }

    public function messages()
    {
        return [
            /* 'avatar.regex' => 'El avatar debe ser una imagen base64.',
            'avatar.required' => 'El avatar es requerido.', */
            /*  'avatar.mimes' => 'El avatar debe ser una imagen mimes.',
            'avatar.max' => 'El avatar no debe pesar más de 2MB.', */
            'phone.required' => 'El teléfono es requerido.',
            'phone.string' => 'El teléfono debe ser una cadena de texto.',
            'phone.max' => 'El teléfono debe tener máximo 255 caracteres.',
            'name.required' => 'El nombre es requerido.',
            'name.string' => 'El nombre debe ser una cadena de texto.',
            'name.max' => 'El nombre debe tener máximo 255 caracteres.',
            'email.required' => 'El email es requerido.',
            'email.string' => 'El email debe ser una cadena de texto.',
            'email.email' => 'El email debe ser un email válido.',
            'email.max' => 'El email debe tener máximo 255 caracteres.',
        ];
    }
}
