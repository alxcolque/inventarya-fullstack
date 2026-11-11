<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreManagedNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('notifications:manage') === true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:150'],
            'message' => ['required', 'string', 'max:1000'],
            'type' => ['required', 'string', 'max:50', 'regex:/^[a-z0-9_-]+$/'],
            'severity' => ['required', Rule::in(['info', 'success', 'warning', 'critical', 'danger'])],
            'action_url' => ['nullable', 'string', 'max:2048', 'starts_with:/'],
            'audience' => ['required', Rule::in(['all', 'admins', 'roles', 'users'])],
            'recipient_roles' => ['exclude_unless:audience,roles', 'required', 'array', 'min:1'],
            'recipient_roles.*' => [Rule::in(['owner', 'admin', 'staff'])],
            'user_ids' => ['exclude_unless:audience,users', 'required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'distinct', 'exists:users,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'El título es obligatorio.',
            'message.required' => 'El mensaje es obligatorio.',
            'recipient_roles.required_if' => 'Selecciona al menos un rol destinatario.',
            'recipient_roles.required' => 'Selecciona al menos un rol destinatario.',
            'recipient_roles.min' => 'Selecciona al menos un rol destinatario.',
            'user_ids.required_if' => 'Selecciona al menos un usuario destinatario.',
            'user_ids.required' => 'Selecciona al menos un usuario destinatario.',
            'user_ids.min' => 'Selecciona al menos un usuario destinatario.',
        ];
    }
}
