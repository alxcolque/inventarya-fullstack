<?php

namespace App\Http\Requests;

use App\Models\Domain;
use App\Rules\ValidDomain;
use App\Support\DomainNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class DomainRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $routeDomain = $this->route('domain');
        $domainId = $routeDomain instanceof Domain ? $routeDomain->getKey() : null;

        return [
            'domain' => [
                'required',
                'string',
                'max:253',
                new ValidDomain,
                Rule::unique('domains', 'domain')->ignore($domainId),
            ],
            'tenant_id' => 'required|string|exists:tenants,id',
            'type' => 'required|string|in:subdomain,custom',
            'is_primary' => 'boolean',
            'status' => 'prohibited',
            'verified_at' => 'prohibited',
        ];
    }

    protected function prepareForValidation(): void
    {
        $domain = $this->input('domain');

        if (! is_string($domain)) {
            return;
        }

        try {
            $this->merge(['domain' => DomainNormalizer::normalize($domain)]);
        } catch (InvalidArgumentException) {
            // ValidDomain returns the precise validation error.
        }
    }
}
