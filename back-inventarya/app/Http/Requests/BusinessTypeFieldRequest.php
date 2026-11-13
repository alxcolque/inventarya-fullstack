<?php

namespace App\Http\Requests;

use App\Models\BusinessTypeField;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BusinessTypeFieldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isUpdate = $this->isMethod('put') || $this->isMethod('patch');
        $presence = $isUpdate ? 'sometimes' : 'required';

        return [
            'key' => [
                $presence,
                'string',
                'max:100',
                'regex:/^[a-z][a-z0-9_]*$/',
                Rule::unique('central.business_type_fields', 'key')
                    ->where('business_type_id', $this->route('business_type'))
                    ->ignore($this->route('field')),
            ],
            'label' => [$presence, 'string', 'max:150'],
            'type' => [$presence, Rule::in(BusinessTypeField::TYPES)],
            'is_required' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
            'options' => ['nullable', 'array', 'max:100'],
            'options.*' => ['string', 'max:100', 'distinct'],
            'validation' => ['nullable', 'array'],
            'validation.min_length' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'validation.max_length' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'validation.min' => ['nullable', 'numeric'],
            'validation.max' => ['nullable', 'numeric'],
            'validation.decimals' => ['nullable', 'integer', 'between:0,8'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $type = $this->input('type');

                if ($type === null && $this->route('field')) {
                    $type = BusinessTypeField::query()->whereKey($this->route('field'))->value('type');
                }

                if ($type === BusinessTypeField::TYPE_SELECT && ! $this->filled('options')) {
                    // On update the stored options are kept when none are sent.
                    $hasStored = $this->route('field')
                        && ! empty(BusinessTypeField::query()->whereKey($this->route('field'))->value('options'));

                    if (! $this->isMethod('put') && ! $this->isMethod('patch') || ! $hasStored) {
                        $validator->errors()->add('options', 'Un campo de selección requiere al menos una opción.');
                    }
                }

                $this->assertRange($validator, 'validation.min_length', 'validation.max_length');
                $this->assertRange($validator, 'validation.min', 'validation.max');
            },
        ];
    }

    private function assertRange(Validator $validator, string $minKey, string $maxKey): void
    {
        $min = $this->input($minKey);
        $max = $this->input($maxKey);

        if (is_numeric($min) && is_numeric($max) && (float) $min > (float) $max) {
            $validator->errors()->add($maxKey, 'El máximo no puede ser menor que el mínimo.');
        }
    }

    public function attributes(): array
    {
        return [
            'key' => 'clave interna',
            'label' => 'etiqueta',
            'type' => 'tipo de dato',
            'options' => 'opciones',
            'options.*' => 'opción',
        ];
    }

    public function messages(): array
    {
        return [
            'key.regex' => 'La clave interna debe empezar con una letra y solo admite minúsculas, números y guion bajo.',
            'key.unique' => 'Ya existe un campo con esa clave en este tipo de negocio.',
            'type.in' => 'El tipo de dato no es válido.',
            'options.*.distinct' => 'Las opciones no pueden repetirse.',
        ];
    }
}

