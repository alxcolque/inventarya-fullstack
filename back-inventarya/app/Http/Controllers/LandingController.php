<?php

namespace App\Http\Controllers;

use App\Models\Configuration;
use App\Models\Carousel;
use App\Models\Faq;
use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LandingController extends Controller
{
    /**
     * Get all public landing page data in a single optimized response.
     */
    public function data(): JsonResponse
    {
        $configuration = Configuration::current();

        $plans = Plan::where('status', 'active')
            ->orderBy('price', 'asc')
            ->get();

        $faqs = Faq::published()
            ->ordered()
            ->get();

        $carousels = Carousel::active()->get();

        return response()->json([
            'configuration' => $configuration,
            'plans'         => $plans,
            'faqs'          => $faqs,
            'carousels'     => $carousels,
        ]);
    }

    /**
     * Get public active plans.
     */
    public function plans(): JsonResponse
    {
        $plans = Plan::where('status', 'active')
            ->orderBy('price', 'asc')
            ->get();

        return response()->json($plans);
    }

    /**
     * Get public published FAQs.
     */
    public function faqs(): JsonResponse
    {
        $faqs = Faq::published()
            ->ordered()
            ->get();

        return response()->json($faqs);
    }

    /**
     * Get public site configuration.
     */
    public function configuration(): JsonResponse
    {
        return response()->json(Configuration::current());
    }

    /**
     * Search active tenants by name, slug, or domain for landing lookup.
     */
    public function searchTenants(Request $request): JsonResponse
    {
        $query = trim((string) $request->input('query', ''));

        $tenantsQuery = Tenant::with('domains')
            ->whereIn('status', ['active', 'trial']);

        if (!empty($query)) {
            $tenantsQuery->where(function ($q) use ($query) {
                $q->where('name', 'ilike', "%{$query}%")
                  ->orWhere('slug', 'ilike', "%{$query}%")
                  ->orWhere('id', 'ilike', "%{$query}%")
                  ->orWhereHas('domains', function ($dq) use ($query) {
                      $dq->where('domain', 'ilike', "%{$query}%");
                  });
            });
        }

        $tenants = $tenantsQuery->limit(8)->get()->map(function ($t) {
            $primaryDomain = $t->domains->where('is_primary', true)->first()?->domain
                ?? $t->domains->first()?->domain
                ?? ($t->slug . (app()->environment('local', 'testing') ? '.localhost:5173' : '.'.config('tenant_domains.root_domain', 'inventarya.com')));

            return [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'status' => $t->status,
                'logo' => $t->logo,
                'primary_domain' => $primaryDomain,
            ];
        });

        return response()->json($tenants);
    }

    /**
     * Resolve a tenant by slug, name or full URL.
     */
    public function resolveTenant(Request $request): JsonResponse
    {
        $input = trim((string) $request->input('input', ''));

        if (empty($input)) {
            return response()->json(['message' => 'Debes ingresar un nombre, identificador o URL.'], 400);
        }

        // Clean URL if provided: e.g. "http://alicia.localhost:5173/..." -> "alicia"
        $candidate = $input;
        if (str_contains($candidate, '://')) {
            $parsedHost = parse_url($candidate, PHP_URL_HOST);
            if ($parsedHost) {
                $candidate = $parsedHost;
            }
        }

        // Remove port if present: e.g. "alicia.localhost:5173" -> "alicia.localhost"
        $candidate = preg_replace('/:\d+$/', '', $candidate);

        // Remove trailing slashes and paths
        $candidate = trim(explode('/', $candidate)[0]);

        // Check if candidate matches subdomain pattern like "alicia.localhost"
        $parts = explode('.', $candidate);
        $extractedSlug = $candidate;
        if (count($parts) > 1) {
            // First segment is the subdomain
            $extractedSlug = $parts[0];
        }

        // Try to find tenant by exact slug, id, or domain
        $tenant = Tenant::with('domains')
            ->where(function ($q) use ($candidate, $extractedSlug, $input) {
                $q->where('slug', $extractedSlug)
                  ->orWhere('id', $extractedSlug)
                  ->orWhere('slug', $candidate)
                  ->orWhere('id', $candidate)
                  ->orWhere('name', 'ilike', $input)
                  ->orWhereHas('domains', function ($dq) use ($candidate, $input) {
                      $dq->where('domain', $candidate)
                         ->orWhere('domain', 'ilike', "%{$candidate}%")
                         ->orWhere('domain', 'ilike', "%{$input}%");
                  });
            })
            ->first();

        if (!$tenant) {
            return response()->json([
                'found' => false,
                'message' => "No encontramos ninguna empresa activa con '{$input}'.",
            ], 404);
        }

        if (!in_array($tenant->status, ['active', 'trial'])) {
            return response()->json([
                'found' => false,
                'status' => $tenant->status,
                'message' => "La empresa '{$tenant->name}' se encuentra en estado '{$tenant->status}' y no está disponible públicamente.",
            ], 403);
        }

        $primaryDomain = $tenant->domains->where('is_primary', true)->first()?->domain
            ?? $tenant->domains->first()?->domain
            ?? ($tenant->slug . (app()->environment('local', 'testing') ? '.localhost:5173' : '.'.config('tenant_domains.root_domain', 'inventarya.com')));

        return response()->json([
            'found' => true,
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'status' => $tenant->status,
                'logo' => $tenant->logo,
                'primary_domain' => $primaryDomain,
            ],
        ]);
    }
}
