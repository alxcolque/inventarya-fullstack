<?php

namespace App\Exceptions;

use Exception;
use App\Traits\ApiResponseTrait;
use Illuminate\Http\JsonResponse;

class ApiException extends Exception
{
    use ApiResponseTrait;

    protected $statusCode;
    protected $errors;

    public function __construct(string $message = "Internal Server Error", int $statusCode = 500, $errors = null)
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->errors = $errors;
    }

    /**
     * Render the exception into an HTTP response.
     */
    public function render($request): JsonResponse
    {
        return $this->errorResponse($this->getMessage(), $this->statusCode, $this->errors);
    }
}
