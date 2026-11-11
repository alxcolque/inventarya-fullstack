<?php

namespace App\Exceptions;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class CashRegisterConflictException extends ValidationException
{
    protected string $errorCode;

    public function __construct(string $errorCode, string $message = '', string $field = 'cash_register')
    {
        $this->errorCode = $errorCode;
        $validator = Validator::make([], []);
        $validator->errors()->add($field, $message);
        parent::__construct($validator);
        $this->message = $message;
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
