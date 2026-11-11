<?php

namespace App\Rules;

use App\Support\DomainNormalizer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use InvalidArgumentException;

class ValidDomain implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail('El campo :attribute debe ser un dominio válido.');

            return;
        }

        try {
            DomainNormalizer::normalize($value);
        } catch (InvalidArgumentException $exception) {
            $fail($exception->getMessage());
        }
    }
}
