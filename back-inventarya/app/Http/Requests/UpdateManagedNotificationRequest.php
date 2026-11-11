<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateManagedNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('notifications:manage') === true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:150'],
            'message' => ['sometimes', 'required', 'string', 'max:1000'],
            'type' => ['sometimes', 'required', 'string', 'max:50', 'regex:/^[a-z0-9_-]+$/'],
            'severity' => ['sometimes', 'required', Rule::in(['info', 'success', 'warning', 'critical', 'danger'])],
            'action_url' => ['sometimes', 'nullable', 'string', 'max:2048', 'starts_with:/'],
        ];
    }
}
