<?php

namespace App\Exceptions;

use Exception;

class IdempotencyConflictException extends Exception
{
    protected $message = 'Conflicto de idempotencia: el identificador UUID ya fue utilizado para una operación con contenido diferente.';
}
