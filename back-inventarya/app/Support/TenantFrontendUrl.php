<?php

namespace App\Support;

class TenantFrontendUrl
{
    public static function to(string $path = '/'): string
    {
        $tenantSlug = (string) (tenant('slug') ?? tenant('id'));
        $configuredUrl = config('invitations.tenant_frontend_url');

        if ($configuredUrl) {
            $baseUrl = str_replace('{tenant}', $tenantSlug, $configuredUrl);
        } else {
            $domain = tenant()?->domains()->orderByDesc('is_primary')->value('domain');

            if ($domain) {
                $isLocal = str_contains($domain, 'localhost') || str_starts_with($domain, '127.0.0.1');
                if ($isLocal && ! preg_match('/:\d+$/', $domain)) {
                    $domain .= ':'.config('invitations.local_frontend_port');
                }
                $baseUrl = ($isLocal ? 'http://' : 'https://').$domain;
            } elseif (app()->environment('local', 'testing')) {
                $baseUrl = "http://{$tenantSlug}.localhost:".config('invitations.local_frontend_port');
            } else {
                $rootDomain = config('invitations.tenant_root_domain');
                $baseUrl = "https://{$tenantSlug}.{$rootDomain}";
            }
        }

        return rtrim($baseUrl, '/').'/'.ltrim($path, '/');
    }
}
