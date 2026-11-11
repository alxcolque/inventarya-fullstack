<?php

namespace App\Http\Middleware;

use App\Models\Domain;
use App\Models\Tenant;
use App\Support\DomainNormalizer;
use App\Tenancy\ProductionTenantResolver;
use App\Tenancy\TenantDomainAccessPolicy;
use Closure;
use Illuminate\Http\Request;
use InvalidArgumentException;

class InitializeTenancyFlexible
{
    public function __construct(
        private readonly ProductionTenantResolver $productionResolver,
        private readonly TenantDomainAccessPolicy $accessPolicy,
    ) {}

    public function handle(Request $request, Closure $next)
    {
        if (tenancy()->initialized) {
            if (config('database.default') !== 'tenant') {
                \Illuminate\Support\Facades\DB::setDefaultConnection('tenant');
            }
            return $next($request);
        }

        if (app()->environment('local', 'testing')) {
            return $this->handleLegacyDevelopmentRequest($request, $next);
        }

        $resolution = $this->productionResolver->resolve(
            host: $request->getHost(),
            xTenant: $this->stringHeader($request, 'X-Tenant'),
            xTenantDomain: $this->stringHeader($request, 'X-Tenant-Domain'),
            origin: $this->stringHeader($request, 'Origin'),
        );

        if ($resolution->isCentral()) {
            return $next($request);
        }

        if (! $resolution->isTenant() || ! $resolution->context) {
            return response()->json([
                'code' => $resolution->code,
                'message' => $resolution->message,
            ], $resolution->httpStatus);
        }

        $tenant = Tenant::find($resolution->context->tenantId);
        if (! $tenant) {
            return response()->json([
                'code' => 'TENANT_NOT_FOUND',
                'message' => 'El tenant asociado al dominio no existe.',
            ], 404);
        }

        // Recheck the current tenant row after the cached domain lookup.
        if ($denial = $this->accessPolicy->denialForTenantStatus($tenant->status)) {
            return response()->json([
                'code' => $denial['code'],
                'message' => $denial['message'],
            ], $denial['status']);
        }

        tenancy()->initialize($tenant);

        return $next($request);
    }

    /**
     * Preserve the existing header/query/slug/port conveniences only in
     * local and testing environments. They are intentionally not production
     * authority.
     */
    private function handleLegacyDevelopmentRequest(Request $request, Closure $next)
    {
        $host = $request->getHost();
        $tenant = null;
        $tenantHint = $this->stringHeader($request, 'X-Tenant')
            ?? $this->stringHeader($request, 'X-Tenant-Domain')
            ?? (is_string($request->query('tenant')) ? $request->query('tenant') : null);

        if ($tenantHint) {
            $tenant = Tenant::find($tenantHint)
                ?? Tenant::where('slug', $tenantHint)->first();

            if (! $tenant) {
                try {
                    $domain = DomainNormalizer::normalize($tenantHint);
                    $tenant = Domain::where('domain', $domain)->first()?->tenant;
                } catch (InvalidArgumentException) {
                    // The hint may legitimately be a local tenant id/slug.
                }
            }
        }

        if (! $tenant) {
            try {
                $normalizedHost = DomainNormalizer::normalize($host);
                $tenant = Domain::where('domain', $normalizedHost)->first()?->tenant;
            } catch (InvalidArgumentException) {
                // Continue with legacy local fallbacks.
            }
        }

        if (! $tenant) {
            $parts = explode('.', $host);
            if (count($parts) > 1 && ! in_array($host, config('tenancy.central_domains', []), true)) {
                $subdomain = $parts[0];
                if (! in_array($subdomain, ['admin', 'www'], true)) {
                    $tenant = Tenant::find($subdomain) ?? Tenant::where('slug', $subdomain)->first();
                }
            }
        }

        if (! $tenant) {
            $source = $this->stringHeader($request, 'Origin')
                ?? $this->stringHeader($request, 'Referer');

            if ($source) {
                $originHost = parse_url($source, PHP_URL_HOST);
                if (is_string($originHost)) {
                    try {
                        $originHost = DomainNormalizer::normalize($originHost);
                        $tenant = Domain::where('domain', $originHost)->first()?->tenant;
                    } catch (InvalidArgumentException) {
                        $originHost = null;
                    }

                    if (! $tenant && $originHost) {
                        $originParts = explode('.', $originHost);
                        if (count($originParts) > 1 && ! in_array($originParts[0], ['admin', 'www'], true)) {
                            $tenant = Tenant::find($originParts[0])
                                ?? Tenant::where('slug', $originParts[0])->first();
                        }
                    }
                }

                if (! $tenant) {
                    $port = parse_url($source, PHP_URL_PORT);
                    if ($port && $port !== 5173) {
                        $tenant = Tenant::where('data->local_port', (int) $port)
                            ->orWhere('data->local_port', (string) $port)
                            ->first();
                    }
                }
            }
        }

        if ($tenant) {
            tenancy()->initialize($tenant);

            return $next($request);
        }

        if (in_array($host, config('tenancy.central_domains', []), true)) {
            return $next($request);
        }

        return response()->json([
            'code' => 'TENANT_NOT_FOUND',
            'message' => 'Tenant no identificado o no encontrado para esta solicitud.',
        ], 404);
    }

    private function stringHeader(Request $request, string $name): ?string
    {
        $value = $request->header($name);

        return is_string($value) && trim($value) !== '' ? $value : null;
    }
}
