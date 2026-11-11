<?php

namespace App\Http\Controllers;

use App\Http\Requests\DomainRequest;
use App\Models\Domain;
use App\Models\Tenant;
use App\Services\DomainRegistrationService;

class DomainController extends Controller
{
    public function __construct(private readonly DomainRegistrationService $domains) {}

    public function index()
    {
        return response()->json(Domain::with('tenant')->get());
    }

    public function store(DomainRequest $request)
    {
        $data = $request->validated();
        $tenant = Tenant::findOrFail($data['tenant_id']);
        $domain = $this->domains->create($tenant, $data);

        return response()->json([
            'message' => 'Dominio creado correctamente',
            'domain' => $domain,
        ], 201);
    }

    public function show(Domain $domain)
    {
        return response()->json($domain->load('tenant'));
    }

    public function update(DomainRequest $request, Domain $domain)
    {
        $data = $request->validated();
        if ($data['tenant_id'] !== $domain->tenant_id) {
            return response()->json([
                'message' => 'No se permite transferir un dominio entre tenants.',
            ], 422);
        }

        $domain = $this->domains->update($domain, $data);

        return response()->json([
            'message' => 'Dominio actualizado correctamente',
            'domain' => $domain,
        ], 200);
    }

    public function destroy(Domain $domain)
    {
        $domain->delete();

        return response()->json([
            'message' => 'Dominio eliminado correctamente',
        ], 200);
    }
}
