<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('notifications:manage') === true;
    }

    public function rules(): array
    {
        $rules = [
            'title' => 'required|string|max:255',
            'message' => 'required|string|max:1000',
            'type' => 'sometimes|string|max:50',
            'data' => 'sometimes|array',
        ];

        // Reglas específicas según la ruta
        if ($this->routeIs('notifications.send-to-user')) {
            $rules['user_id'] = 'required|integer|exists:users,id';
        } elseif ($this->routeIs('notifications.send-to-users')) {
            $rules['user_ids'] = 'required|array|min:1';
            $rules['user_ids.*'] = 'exists:users,id';
        }

        return $rules;
    }

    public function messages(): array
    {
        return [
            'title.required' => 'El título es obligatorio',
            'message.required' => 'El mensaje es obligatorio',
            'user_id.required' => 'Debe especificar un usuario',
            'user_id.exists' => 'El usuario no existe',
            'user_ids.required' => 'Debe especificar al menos un usuario',
            'user_ids.*.exists' => 'Uno o más usuarios no existen',
        ];
    }
}
