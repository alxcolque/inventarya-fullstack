<?php

namespace App\Http\Requests\Log;

use Illuminate\Foundation\Http\FormRequest;

class LogsRequest extends FormRequest
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
            'user'=>'required|string|max:64',
            'acction'=>'required|string|max:255',
            'device'=>'nullable|string|max:128',
            'ip'=>'nullable|string|max:128',
        ];
    }
    public function messages()
    {
        return [
            'user.required'=>'el usuario es requerido',
            'user.string'=>'el usuario debe ser tipo string',
            'user.max'=>'el usuario tiene como maximo 64 caracteres',
            'acction.required'=>'la accion es requerido',
            'acction.string'=>'la accion debe ser tipo string',
            'acction.max'=>'la accion tiene como maximo 255 caracteres',
            'device.string'=>'el dipositivo debe ser tipo string',
            'device.max'=>'el dipositivo tiene como maximo 128 caracteres',
            'ip.string'=>'la ip debe ser tipo string',
            'ip.max'=>'la ip tiene como maximo 128 caracteres'
        ];
    }
}
