<?php

namespace App\Http\Requests;

use App\Models\CentralUser;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCentralProfileRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->name) ? trim($this->name) : $this->name,
            'email' => is_string($this->email) ? strtolower(trim($this->email)) : $this->email,
        ]);
    }

    public function authorize(): bool
    {
        return $this->user() instanceof CentralUser;
    }

    public function rules(): array
    {
        /** @var CentralUser|null $user */
        $user = $this->user();

        return [
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => [
                'required',
                'string',
                'email',
                'max:150',
                Rule::unique('central_users', 'email')->ignore($user?->getKey()),
            ],
            'avatar' => [
                'sometimes',
                'nullable',
                'string',
                function (string $attribute, mixed $value, Closure $fail) use ($user): void {
                    if ($value === null || $value === 'delete' || $value === $user?->avatar) {
                        return;
                    }

                    if (! preg_match('#^data:image/(jpeg|jpg|png|webp);base64,#i', $value)) {
                        $fail('El avatar debe ser una imagen JPG, PNG o WebP válida.');

                        return;
                    }

                    $encoded = substr($value, strpos($value, ',') + 1);
                    $decoded = base64_decode($encoded, true);

                    if ($decoded === false) {
                        $fail('El contenido del avatar no es válido.');

                        return;
                    }

                    if (strlen($decoded) > 2 * 1024 * 1024) {
                        $fail('El avatar no debe superar los 2 MB.');
                    }
                },
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es obligatorio.',
            'name.min' => 'El nombre debe tener al menos 2 caracteres.',
            'name.max' => 'El nombre no debe superar los 100 caracteres.',
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'Ingresa un correo electrónico válido.',
            'email.max' => 'El correo no debe superar los 150 caracteres.',
            'email.unique' => 'Este correo electrónico ya está en uso.',
        ];
    }
}
