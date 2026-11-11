<?php

namespace App\Exceptions;

class SiatFiscalException extends ApiException
{
    public function __construct(string $message = "Error de validación fiscal SIAT", int $statusCode = 422, $errors = null)
    {
        parent::__construct($message, $statusCode, $errors);
    }
}
