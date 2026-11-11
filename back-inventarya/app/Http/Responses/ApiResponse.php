<?php

namespace App\Http\Responses;

use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;

class ApiResponse implements Responsable
{
    /**
     * @param bool $success
     * @param string|null $message
     * @param mixed $data
     * @param mixed $errors
     * @param mixed $meta
     * @param int $statusCode
     */
    public function __construct(
        protected bool $success,
        protected ?string $message = null,
        protected mixed $data = null,
        protected mixed $errors = null,
        protected mixed $meta = null,
        protected int $statusCode = 200
    ) {}

    /**
     * Create an HTTP response that represents the object.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function toResponse($request): JsonResponse
    {
        $payload = [
            'success' => $this->success,
            'message' => $this->message,
            'data'    => $this->data,
            'errors'  => $this->errors,
            'meta'    => $this->meta,
        ];

        return response()->json(array_filter($payload, function ($value) {
            return !is_null($value) || is_bool($value);
        }), $this->statusCode);
    }

    /**
     * Helper to create a success response.
     */
    public static function success($data = null, string $message = 'Operación exitosa', int $code = 200, $meta = null): self
    {
        return new self(true, $message, $data, null, $meta, $code);
    }

    /**
     * Helper to create an error response.
     */
    public static function error(string $message = 'Error en la operación', int $code = 400, $errors = null): self
    {
        return new self(false, $message, null, $errors, null, $code);
    }
}
