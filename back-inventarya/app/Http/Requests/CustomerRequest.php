<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CustomerRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prepare inputs for validation (handling backwards-compatible cinit).
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('cinit') && !$this->has('document_number')) {
            $this->merge([
                'document_number' => $this->cinit,
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $customerId = $this->route('customer') ?? $this->id;

        $uniqueRule = Rule::unique('customers', 'document_number')
            ->where(function ($query) {
                return $query
                    ->where('document_type', $this->input('document_type'))
                    ->where('document_complement', $this->input('document_complement'));
            });

        if ($customerId) {
            $uniqueRule->ignore($customerId);
        }

        return [
            'name'                => 'required|string|max:150',
            'phone'               => 'nullable|string|max:20',
            'email'               => 'nullable|email|max:150',
            'address'             => 'nullable|string|max:255',
            'document_type'       => 'nullable|integer',
            'document_number'     => ['nullable', 'string', 'max:50', $uniqueRule],
            'document_complement' => 'nullable|string|max:20',
        ];
    }

    public function messages(): array
    {
        return [
            'name.required'              => 'El nombre completo es obligatorio',
            'name.string'                => 'El nombre debe ser una cadena de texto',
            'name.max'                   => 'El nombre no debe exceder los 150 caracteres',
            'document_number.string'     => 'El número de documento debe ser una cadena de texto',
            'document_number.max'        => 'El número de documento no debe exceder los 50 caracteres',
            'document_number.unique'     => 'Ya existe un cliente registrado con este documento y complemento',
            'document_type.integer'      => 'El tipo de documento debe ser un valor numérico válido',
            'document_complement.string' => 'El complemento debe ser una cadena de texto',
            'document_complement.max'    => 'El complemento no debe exceder los 20 caracteres',
            'email.email'                => 'El correo electrónico debe tener un formato válido',
            'email.max'                  => 'El correo electrónico no debe exceder los 150 caracteres',
            'phone.max'                  => 'El teléfono no debe exceder los 20 caracteres',
            'address.max'                => 'La dirección no debe exceder los 255 caracteres',
        ];
    }
}
