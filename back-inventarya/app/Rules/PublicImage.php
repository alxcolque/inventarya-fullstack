<?php

namespace App\Rules;

use App\Services\FileStorageService;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class PublicImage implements ValidationRule
{
    public function __construct(
        private readonly int $maxKilobytes = 2048,
        private readonly bool $allowManagedReference = true,
        private readonly bool $allowExternalUrl = true,
        private readonly bool $allowDeleteSentinel = false,
    ) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $error = FileStorageService::imageValidationError(
            $value,
            $this->maxKilobytes * 1024,
            $this->allowManagedReference,
            $this->allowExternalUrl,
            $this->allowDeleteSentinel,
        );

        if ($error !== null) {
            $fail($error);
        }
    }
}
