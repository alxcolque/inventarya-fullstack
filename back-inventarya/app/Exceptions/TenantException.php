<?php

namespace App\Exceptions;

class TenantException extends ApiException
{
    public function __construct(string $message = "Tenant configuration error", int $statusCode = 403, $errors = null)
    {
        parent::__construct($message, $statusCode, $errors);
    }
}
