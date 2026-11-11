<?php

namespace App\Support;

use InvalidArgumentException;

final class DomainNormalizer
{
    /**
     * Normalize a hostname or a URL containing only a hostname.
     *
     * Ports, an optional HTTP(S) scheme, one trailing slash and the final
     * DNS dot are accepted. Paths, query strings, fragments and credentials
     * are deliberately rejected.
     */
    public static function normalize(string $value): string
    {
        $value = trim($value);

        if ($value === '' || preg_match('/[\x00-\x1F\x7F]/', $value)) {
            throw new InvalidArgumentException('El dominio está vacío o contiene caracteres de control.');
        }

        $hasScheme = str_contains($value, '://');
        $candidate = $hasScheme ? $value : 'http://'.$value;
        $parts = parse_url($candidate);

        if (! is_array($parts) || empty($parts['host'])) {
            throw new InvalidArgumentException('El dominio no tiene un hostname válido.');
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? 'http'));
        if (! in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException('Sólo se permiten esquemas HTTP o HTTPS.');
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('El dominio no puede contener credenciales.');
        }

        if (isset($parts['query']) || isset($parts['fragment'])) {
            throw new InvalidArgumentException('El dominio no puede contener query strings ni fragmentos.');
        }

        $path = (string) ($parts['path'] ?? '');
        if ($path !== '' && trim($path, '/') !== '') {
            throw new InvalidArgumentException('El dominio no puede contener rutas.');
        }

        return self::normalizeHostname((string) $parts['host']);
    }

    /**
     * Normalize a browser Origin and retain its explicit port.
     *
     * @return array{origin: string, host: string, scheme: string, port: int|null}
     */
    public static function normalizeOrigin(string $origin): array
    {
        $origin = trim($origin);
        $parts = parse_url($origin);

        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            throw new InvalidArgumentException('El Origin no es válido.');
        }

        $scheme = strtolower((string) $parts['scheme']);
        if (! in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException('El Origin debe utilizar HTTP o HTTPS.');
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('El Origin no puede contener credenciales.');
        }

        if (isset($parts['query']) || isset($parts['fragment'])) {
            throw new InvalidArgumentException('El Origin no puede contener query strings ni fragmentos.');
        }

        $path = (string) ($parts['path'] ?? '');
        if ($path !== '' && $path !== '/') {
            throw new InvalidArgumentException('El Origin no puede contener rutas.');
        }

        $host = self::normalizeHostname((string) $parts['host']);
        $port = isset($parts['port']) ? (int) $parts['port'] : null;
        $normalizedOrigin = $scheme.'://'.$host.($port ? ':'.$port : '');

        return [
            'origin' => $normalizedOrigin,
            'host' => $host,
            'scheme' => $scheme,
            'port' => $port,
        ];
    }

    private static function normalizeHostname(string $hostname): string
    {
        $hostname = strtolower(trim($hostname));

        if (str_ends_with($hostname, '.')) {
            $hostname = substr($hostname, 0, -1);
        }

        if ($hostname === '') {
            throw new InvalidArgumentException('El hostname está vacío.');
        }

        if (preg_match('/[^\x20-\x7E]/', $hostname)) {
            if (! function_exists('idn_to_ascii')) {
                throw new InvalidArgumentException('Los dominios IDN requieren la extensión PHP intl.');
            }

            $flags = defined('IDNA_DEFAULT') ? IDNA_DEFAULT : 0;
            $variant = defined('INTL_IDNA_VARIANT_UTS46') ? INTL_IDNA_VARIANT_UTS46 : 1;
            $ascii = idn_to_ascii($hostname, $flags, $variant);

            if ($ascii === false) {
                throw new InvalidArgumentException('El dominio IDN no es válido.');
            }

            $hostname = strtolower($ascii);
        }

        if (strlen($hostname) > 253) {
            throw new InvalidArgumentException('El hostname supera la longitud máxima permitida.');
        }

        if (filter_var($hostname, FILTER_VALIDATE_IP) !== false) {
            return $hostname;
        }

        foreach (explode('.', $hostname) as $label) {
            if ($label === '' || strlen($label) > 63 || ! preg_match('/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/', $label)) {
                throw new InvalidArgumentException('El hostname contiene una etiqueta DNS inválida.');
            }
        }

        return $hostname;
    }
}
