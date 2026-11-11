<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class NormalizeDecimalInputs
{
    /**
     * Handle an incoming request.
     * Recursively normalizes string inputs that represent decimal numbers with comma
     * into standard dot decimal notation (e.g., "12,50" -> "12.50").
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (in_array($request->method(), ['POST', 'PUT', 'PATCH'], true)) {
            $input = $request->all();
            if (! empty($input)) {
                $normalized = $this->normalizeArray($input);
                $request->replace($normalized);
            }
        }

        return $next($request);
    }

    /**
     * Recursively traverse and normalize array data.
     */
    private function normalizeArray(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = $this->normalizeArray($value);
            } elseif (is_string($value)) {
                $data[$key] = $this->normalizeDecimalValue($key, $value);
            }
        }

        return $data;
    }

    /**
     * Check if a string represents a decimal number using comma, and convert it to dot.
     */
    private function normalizeDecimalValue(string $key, string $value): string
    {
        $trimmed = trim($value);

        // Si es vacío o no contiene coma, retornar tal cual
        if ($trimmed === '' || ! str_contains($trimmed, ',')) {
            return $value;
        }

        // Caso 1: Número simple con coma decimal ej: "12,50", "-0,75", "150,00"
        if (preg_match('/^-?\d+,\d+$/', $trimmed)) {
            return str_replace(',', '.', $trimmed);
        }

        // Caso 2: Número con separadores de miles con punto y decimales con coma ej: "1.250,50"
        if (preg_match('/^-?\d{1,3}(\.\d{3})+,\d+$/', $trimmed)) {
            return str_replace(['.', ','], ['', '.'], $trimmed);
        }

        return $value;
    }
}
