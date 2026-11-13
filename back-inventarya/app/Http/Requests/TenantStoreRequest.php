<?php

namespace App\Http\Requests;

use App\Rules\ValidDomain;
use App\Support\DomainConfiguration;
use App\Support\DomainNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use InvalidArgumentException;

class TenantStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Tenant details
            'tenant.name' => 'required|string|max:100',
            'tenant.slug' => ['nullable', 'string', 'max:36', 'regex:/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/', 'unique:tenants,slug'],
            'tenant.database' => 'required|string|max:100|alpha_dash|unique:tenants,database',
            'tenant.owner_name' => 'nullable|string|max:100',
            'tenant.owner_email' => 'nullable|email|max:150',
            'tenant.owner_phone' => 'nullable|string|max:50',
            'tenant.logo' => 'nullable|string',
            'tenant.data' => 'nullable|array',
            'tenant.business_type_id' => [
                'required',
                'integer',
                Rule::exists('central.business_types', 'id')->where('is_active', true),
            ],

            // Domain details
            'domains' => 'sometimes|array',
            'domains.*.domain' => ['required', 'string', 'max:253', new ValidDomain, 'distinct', 'unique:domains,domain'],
            'domains.*.type' => 'required|string|in:subdomain,custom',
            'domains.*.is_primary' => 'sometimes|boolean',

            // Subscription details
            'subscription.plan_id' => 'required|exists:plans,id',
            'subscription.billing_cycle' => 'required|string|in:monthly,yearly',

            // Owner Account details
            'owner.name' => 'required|string|max:100',
            'owner.email' => 'required|email|max:150',
            'owner.password' => 'required|string|min:6',
        ];
    }

    protected function prepareForValidation(): void
    {
        $domains = $this->input('domains');
        if (! is_array($domains)) {
            return;
        }

        foreach ($domains as $index => $domain) {
            if (! is_array($domain) || ! is_string($domain['domain'] ?? null)) {
                continue;
            }

            try {
                $domains[$index]['domain'] = DomainNormalizer::normalize($domain['domain']);
            } catch (InvalidArgumentException) {
                // ValidDomain reports the reason.
            }
        }

        $this->merge(['domains' => $domains]);
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                foreach ((array) $this->input('domains', []) as $index => $domain) {
                    if (! is_array($domain) || ! is_string($domain['domain'] ?? null) || ! is_string($domain['type'] ?? null)) {
                        continue;
                    }

                    try {
                        $expectedType = DomainConfiguration::isInternalTenantDomain($domain['domain'])
                            ? 'subdomain'
                            : 'custom';
                    } catch (InvalidArgumentException) {
                        continue;
                    }

                    if ($domain['type'] !== $expectedType) {
                        $validator->errors()->add(
                            "domains.{$index}.type",
                            $expectedType === 'custom'
                                ? 'Un dominio externo debe registrarse como custom.'
                                : 'Un dominio administrado por INVENTARYA debe registrarse como subdomain.'
                        );
                    }
                }
            },
        ];
    }

    /**
     * Get custom attributes for validator errors.
     */
    public function attributes(): array
    {
        return [
            'tenant.name' => 'nombre del negocio',
            'tenant.slug' => 'slug del negocio',
            'tenant.database' => 'nombre de base de datos',
            'tenant.owner_name' => 'nombre del propietario',
            'tenant.owner_email' => 'correo del propietario',
            'tenant.owner_phone' => 'teléfono del propietario',
            'tenant.business_type_id' => 'tipo de negocio',
            'domains' => 'dominios',
            'domains.*.domain' => 'dominio',
            'domains.*.type' => 'tipo de dominio',
            'domains.*.is_primary' => 'dominio principal',
            'subscription.plan_id' => 'plan',
            'subscription.billing_cycle' => 'ciclo de facturación',
            'owner.name' => 'nombre del administrador',
            'owner.email' => 'correo del administrador',
            'owner.password' => 'contraseña',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'required' => 'El campo :attribute es obligatorio.',
            'string' => 'El campo :attribute debe ser una cadena de texto.',
            'max' => 'El campo :attribute no debe superar los :max caracteres.',
            'email' => 'El campo :attribute debe ser un correo electrónico válido.',
            'array' => 'El campo :attribute debe ser una lista.',
            'min' => 'El campo :attribute debe tener al menos :min caracteres.',
            'in' => 'El valor seleccionado para :attribute no es válido.',
            'exists' => 'El campo :attribute seleccionado no existe.',
            'unique' => 'El campo :attribute ya está en uso.',
            'tenant.business_type_id.required' => 'Debes seleccionar un tipo de negocio.',
            'tenant.business_type_id.exists' => 'El tipo de negocio seleccionado no existe o está inactivo.',
        ];
    }
}
