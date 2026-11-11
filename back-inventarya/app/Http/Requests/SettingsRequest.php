<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SettingsRequest extends FormRequest
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
        return [
            'business_name' => 'required|string|max:100',
            'logo' => 'nullable|string',
            'favicon' => 'nullable|string',
            'email' => 'nullable|email|max:150',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'theme' => 'string|in:light,dark',
            'primary_color' => 'nullable|string|max:20',
            'terms' => 'nullable|string',
            'policy' => 'nullable|string',
            'currency' => 'string|max:10',
            'timezone' => 'string|max:50',
            'social' => 'nullable|array',
        ];
    }
}
