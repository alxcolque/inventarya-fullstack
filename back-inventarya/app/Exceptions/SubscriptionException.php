<?php

namespace App\Exceptions;

class SubscriptionException extends ApiException
{
    public function __construct(string $message = "Subscription error", int $statusCode = 402, $errors = null)
    {
        parent::__construct($message, $statusCode, $errors);
    }
}
