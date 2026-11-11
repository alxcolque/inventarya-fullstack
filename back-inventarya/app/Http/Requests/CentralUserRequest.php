<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CentralUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('central_user'); // Ajustado al nombre del parámetro en la ruta
        $rules = [
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:150|unique:central_users,email,' . $id,
            'role' => 'required|string|in:superadmin,support',
            'status' => 'required|string|in:active,inactive,suspended',
        ];
        
        if ($this->isMethod('post')) {
            $rules['password'] = 'required|string|min:6';
        } else {
            $rules['password'] = 'nullable|string|min:6';
        }
        
        return $rules;
    }
}
