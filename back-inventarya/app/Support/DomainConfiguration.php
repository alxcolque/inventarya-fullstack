<?php

namespace App\Support;

class DomainConfiguration
{
    public static function tenantRootDomain(): string
    {
        $configured = function_exists('config') ? config('tenant_domains.root_domain') : null;
        if (is_string($configured) && $configured !== '') {
            return DomainNormalizer::normalize($configured);
        }
        return DomainNormalizer::normalize((string) env('TENANT_ROOT_DOMAIN', 'inventarya.com'));
    }

    /**
     * @return array<int, string>
     */
    public static function tenantRootDomains(): array
    {
        $configured = function_exists('config') ? config('tenant_domains.root_domains') : null;
        if (is_array($configured) && $configured !== []) {
            return self::unique(array_map(
                fn (string $domain): string => DomainNormalizer::normalize($domain),
                $configured
            ));
        }
        return self::unique(array_map(
            fn (string $domain): string => DomainNormalizer::normalize($domain),
            self::csv('TENANT_ROOT_DOMAINS', 'inventarya.com')
        ));
    }

    public static function isInternalTenantDomain(string $domain): bool
    {
        $domain = DomainNormalizer::normalize($domain);
        $configuredRoots = config('tenant_domains.root_domains');
        $rootDomains = is_array($configuredRoots)
            ? $configuredRoots
            : self::tenantRootDomains();

        foreach ($rootDomains as $rootDomain) {
            $suffix = '.'.$rootDomain;
            $prefix = str_ends_with($domain, $suffix)
                ? substr($domain, 0, -strlen($suffix))
                : '';

            if ($prefix !== '' && ! str_contains($prefix, '.')) {
                return true;
            }
        }

        $isLocal = app()->bound('env')
            ? app()->environment('local', 'testing')
            : self::isLocalEnvironment();

        return $isLocal
            && $domain !== 'localhost'
            && str_ends_with($domain, '.localhost');
    }

    /**
     * Central hosts accepted by Laravel's central route group.
     *
     * @return array<int, string>
     */
    public static function centralDomains(): array
    {
        $configured = function_exists('config') ? config('tenancy.central_domains') : null;
        if (is_array($configured) && $configured !== []) {
            return self::unique($configured);
        }

        $domains = self::csv('CENTRAL_DOMAINS', 'inventarya.com,www.inventarya.com,api.inventarya.com,admin.inventarya.com');

        if (self::isLocalEnvironment()) {
            $domains = array_merge(['127.0.0.1', 'localhost', 'admin.localhost'], $domains);
        }

        return self::unique($domains);
    }

    /**
     * Exact browser origins accepted by CORS.
     *
     * @return array<int, string>
     */
    public static function corsAllowedOrigins(): array
    {
        $configured = function_exists('config') ? config('cors.allowed_origins') : null;
        if (is_array($configured) && $configured !== []) {
            return self::unique($configured);
        }

        $origins = self::csv(
            'CORS_ALLOWED_ORIGINS',
            'https://inventarya.com,https://www.inventarya.com,https://admin.inventarya.com,https://localhost,capacitor://localhost'
        );

        if (self::isLocalEnvironment()) {
            $origins = array_merge([
                'http://localhost:5173',
                'http://localhost:5174',
                'http://localhost:5175',
                'http://localhost:8080',
            ], $origins);
        }

        return self::unique($origins);
    }

    /**
     * Browser-origin patterns for tenant subdomains and local development.
     *
     * @return array<int, string>
     */
    public static function corsAllowedOriginPatterns(): array
    {
        $patterns = [];

        if (self::isLocalEnvironment()) {
            $patterns[] = '#^http://localhost:\d+$#';
            $patterns[] = '#^http://[a-zA-Z0-9-]+\.localhost(?::\d+)?$#';
        }

        $scheme = self::isLocalEnvironment() ? 'https?' : 'https';

        foreach (self::tenantRootDomains() as $domain) {
            $quotedDomain = preg_quote($domain, '#');
            $patterns[] = "#^{$scheme}://([a-zA-Z0-9-]+\\.)?{$quotedDomain}(?::\\d+)?$#";
        }

        return self::unique($patterns);
    }

    /**
     * Host patterns accepted by Laravel Reverb.
     *
     * @return array<int, string>
     */
    public static function reverbAllowedOrigins(): array
    {
        $configured = self::csv('REVERB_ALLOWED_ORIGINS');

        if ($configured !== []) {
            return self::unique($configured);
        }

        $origins = self::centralDomains();
        foreach (self::tenantRootDomains() as $domain) {
            $origins[] = "*.{$domain}";
        }

        if (self::isLocalEnvironment()) {
            $origins[] = '*.localhost';
        }

        return self::unique($origins);
    }

    /**
     * @return array<int, string>
     */
    private static function csv(string $key, string $default = ''): array
    {
        return array_values(array_filter(
            array_map('trim', explode(',', (string) env($key, $default))),
            fn (string $value): bool => $value !== ''
        ));
    }

    /**
     * @param  array<int, string>  $values
     * @return array<int, string>
     */
    private static function unique(array $values): array
    {
        return array_values(array_unique(array_filter($values)));
    }

    private static function isLocalEnvironment(): bool
    {
        return in_array(env('APP_ENV', 'production'), ['local', 'testing'], true);
    }
}
