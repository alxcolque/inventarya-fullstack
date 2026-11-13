<?php

namespace App\Http\Controllers;

use App\Services\ProductAttributeService;
use Illuminate\Http\JsonResponse;

class TenantBusinessTypeController extends Controller
{
    public function __construct(private readonly ProductAttributeService $attributes) {}

    /**
     * Product-field contract of the authenticated tenant's business type.
     *
     * The business type is resolved from the tenancy context (never from
     * request input), so a tenant cannot read another tenant's configuration.
     */
    public function productFields(): JsonResponse
    {
        if (! tenant()) {
            return response()->json(['message' => 'No se detectó contexto de tenant.'], 400);
        }

        return response()->json($this->attributes->contractForCurrentTenant());
    }
}

