<?php

namespace App\Http\Controllers;

use App\Http\Requests\TenantStoreRequest;
use App\Models\Tenant;
use App\Services\TenantService;
use App\Support\DomainNormalizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class TenantController extends Controller
{
    protected TenantService $tenantService;

    public function __construct(TenantService $tenantService)
    {
        $this->tenantService = $tenantService;
    }

    public function index()
    {
        $tenants = Tenant::with(['domains', 'plan', 'subscriptions', 'payments', 'currentSubscription', 'businessType:id,name,slug,is_active'])->get();

        return response()->json($tenants);
    }

    public function checkUnique(Request $request)
    {
        $request->validate([
            'field' => 'required|string|in:database,slug,domain,email',
            'value' => 'required|string',
        ]);

        $field = $request->input('field');
        $value = trim($request->input('value'));
        $isAvailable = true;
        $message = '';

        switch ($field) {
            case 'database':
                $dbSlug = strtolower($value);
                $fullDbName = 'tenant_'.$dbSlug;

                $existsInTenants = Tenant::where('database', $dbSlug)
                    ->orWhere('database', $fullDbName)
                    ->exists();

                $existsInPg = false;
                try {
                    $pgCheck = DB::select('SELECT 1 FROM pg_database WHERE datname = :dbname', ['dbname' => $fullDbName]);
                    $existsInPg = ! empty($pgCheck);
                } catch (\Exception $e) {
                    // Ignore if permission issue
                }

                if ($existsInTenants || $existsInPg) {
                    $isAvailable = false;
                    $message = "La base de datos '{$dbSlug}' ya está registrada o existe en el servidor.";
                }
                break;

            case 'slug':
                $slug = strtolower($value);
                if (Tenant::where('slug', $slug)->orWhere('id', $slug)->exists()) {
                    $isAvailable = false;
                    $message = "El identificador '{$slug}' ya está registrado.";
                }
                break;

            case 'domain':
                try {
                    $domain = DomainNormalizer::normalize($value);
                } catch (InvalidArgumentException $exception) {
                    return response()->json([
                        'available' => false,
                        'message' => $exception->getMessage(),
                    ]);
                }
                if (DB::table('domains')->where('domain', $domain)->exists()) {
                    $isAvailable = false;
                    $message = "El dominio '{$domain}' ya está registrado.";
                }
                break;

            case 'email':
                $email = strtolower($value);
                $inTenants = Tenant::where('owner_email', $email)->exists();
                $inUsers = DB::table('users')->where('email', $email)->exists();
                if ($inTenants || $inUsers) {
                    $isAvailable = false;
                    $message = "El correo '{$email}' ya se encuentra registrado.";
                }
                break;
        }

        return response()->json([
            'available' => $isAvailable,
            'message' => $message,
        ]);
    }

    public function store(TenantStoreRequest $request)
    {
        if ($request->user()?->cannot('tenants:create')) {
            return response()->json(['error' => 'No autorizado para crear tenants'], 403);
        }

        $tenant = $this->tenantService->createTenant($request->validated());

        return response()->json([
            'message' => 'Tenant registrado e iniciado correctamente',
            'tenant' => $tenant,
        ], 201);
    }

    public function show($id)
    {
        $tenant = Tenant::with(['domains', 'plan', 'subscriptions', 'payments', 'currentSubscription', 'businessType:id,name,slug,is_active'])->find($id);
        if (! $tenant) {
            return response()->json(['message' => 'Tenant no encontrado'], 404);
        }

        return response()->json($tenant);
    }

    public function update(Request $request, $id)
    {
        if ($request->user()?->cannot('tenants:update')) {
            return response()->json(['error' => 'No autorizado para actualizar tenants'], 403);
        }

        $tenant = Tenant::find($id);
        if (! $tenant) {
            return response()->json(['message' => 'Tenant no encontrado'], 404);
        }

        // Allow partial updates section by section
        $data = $request->validate([
            'name' => 'nullable|string|max:100',
            'slug' => 'nullable|string|unique:tenants,slug,'.$id,
            'database' => 'nullable|string',
            'plan_id' => 'nullable|exists:plans,id',
            'current_subscription_id' => 'nullable|exists:subscriptions,id',
            'status' => 'nullable|string|in:pending,trial,active,suspended,unpaid,expired',
            'trial_ends_at' => 'nullable|date',
            'logo' => 'nullable|string',
            'owner_name' => 'nullable|string|max:100',
            'owner_email' => 'nullable|email|max:150',
            'owner_phone' => 'nullable|string|max:50',
            'data' => 'nullable|array',
            'business_type_id' => [
                'nullable',
                'integer',
                // Active types only, except the one the tenant already has.
                Rule::exists('central.business_types', 'id')->where(
                    fn ($query) => $query->where('is_active', true)->orWhere('id', $tenant->business_type_id)
                ),
            ],
        ], [
            'required' => 'El campo :attribute es obligatorio.',
            'string' => 'El campo :attribute debe ser una cadena de texto.',
            'max' => 'El campo :attribute no debe superar los :max caracteres.',
            'email' => 'El campo :attribute debe ser un correo electrónico válido.',
            'exists' => 'El campo :attribute seleccionado no existe.',
            'unique' => 'El campo :attribute ya está en uso.',
            'business_type_id.exists' => 'El tipo de negocio seleccionado no existe o está inactivo.',
        ], [
            'name' => 'nombre del negocio',
            'slug' => 'slug del negocio',
            'database' => 'nombre de base de datos',
            'plan_id' => 'plan',
            'current_subscription_id' => 'suscripción actual',
            'status' => 'estado',
            'trial_ends_at' => 'fecha de fin de prueba',
            'logo' => 'logo',
            'owner_name' => 'nombre del propietario',
            'owner_email' => 'correo del propietario',
            'owner_phone' => 'teléfono del propietario',
            'data' => 'datos adicionales',
            'business_type_id' => 'tipo de negocio',
        ]);

        // A tenant never loses its business type; null is ignored.
        if (array_key_exists('business_type_id', $data)) {
            if ($data['business_type_id'] === null) {
                unset($data['business_type_id']);
            } else {
                $this->tenantService->assertBusinessTypeChangeAllowed($tenant, (int) $data['business_type_id']);
            }
        }

        $wasInactive = $tenant->status !== 'active';
        $tenant->update($data);

        if ($wasInactive && $tenant->status === 'active') {
            try {
                $this->tenantService->dispatchTenantApproved($tenant);
            } catch (\Throwable $exception) {
                Log::error(
                    'El tenant se activó, pero no se pudo encolar el correo de aprobación.',
                    ['tenant_id' => $tenant->id, 'exception' => $exception->getMessage()]
                );
            }
        }

        return response()->json([
            'message' => 'Tenant actualizado correctamente',
            'tenant' => $tenant,
        ], 200);
    }

    public function destroy(Request $request, $id)
    {
        if ($request->user()?->cannot('tenants:delete')) {
            return response()->json(['error' => 'No autorizado para eliminar tenants'], 403);
        }

        $tenant = Tenant::find($id);
        if (! $tenant) {
            return response()->json(['message' => 'Tenant no encontrado'], 404);
        }

        // Delete models individually so domain cache invalidation is emitted.
        $tenant->domains()->get()->each->delete();
        $tenant->delete();

        return response()->json([
            'message' => 'Tenant y sus dominios asociados eliminados correctamente',
        ], 200);
    }

    public function getDatabaseTables(Request $request, $id)
    {
        if ($request->user()?->cannot('database:manage')) {
            return response()->json(['error' => 'No autorizado para ver la base de datos'], 403);
        }

        $tenant = Tenant::find($id);
        if (! $tenant) {
            return response()->json(['message' => 'Tenant no encontrado'], 404);
        }

        try {
            tenancy()->initialize($tenant);

            $tables = DB::select("
                SELECT 
                    tablename 
                FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename ASC
            ");

            $tablesWithStats = [];
            foreach ($tables as $t) {
                try {
                    $count = DB::table($t->tablename)->count();
                } catch (\Exception $e) {
                    $count = 0;
                }
                $tablesWithStats[] = [
                    'name' => $t->tablename,
                    'rows' => $count,
                ];
            }

            tenancy()->end();

            return response()->json([
                'database' => $tenant->database,
                'host' => $tenant->database_host ?? 'postgres',
                'tables' => $tablesWithStats,
            ]);
        } catch (\Exception $e) {
            if (tenancy()->initialized) {
                tenancy()->end();
            }

            return response()->json([
                'message' => 'Error al conectar o consultar la base de datos: '.$e->getMessage(),
            ], 500);
        }
    }

    public function getTableData(Request $request, $id, $table)
    {
        if ($request->user()?->cannot('database:manage')) {
            return response()->json(['error' => 'No autorizado para ver la base de datos'], 403);
        }

        $tenant = Tenant::find($id);
        if (! $tenant) {
            return response()->json(['message' => 'Tenant no encontrado'], 404);
        }

        if (! preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            return response()->json(['message' => 'Nombre de tabla inválido'], 400);
        }

        try {
            tenancy()->initialize($tenant);

            $columns = DB::select("
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = :table AND table_schema = 'public'
                ORDER BY ordinal_position ASC
            ", ['table' => $table]);

            $rows = DB::table($table)->limit(100)->get();

            tenancy()->end();

            return response()->json([
                'table' => $table,
                'columns' => $columns,
                'rows' => $rows,
            ]);
        } catch (\Exception $e) {
            if (tenancy()->initialized) {
                tenancy()->end();
            }

            return response()->json([
                'message' => 'Error al obtener datos de la tabla: '.$e->getMessage(),
            ], 500);
        }
    }

    public function clearTableData(Request $request, $id, $table)
    {
        if ($request->user()?->cannot('database:manage')) {
            return response()->json(['error' => 'No autorizado para vaciar tablas'], 403);
        }

        $tenant = Tenant::find($id);
        if (! $tenant) {
            return response()->json(['message' => 'Tenant no encontrado'], 404);
        }

        if (! preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            return response()->json(['message' => 'Nombre de tabla inválido'], 400);
        }

        if ($table === 'migrations') {
            return response()->json(['message' => 'No se puede vaciar la tabla de migraciones'], 400);
        }

        try {
            tenancy()->initialize($tenant);

            DB::statement("TRUNCATE TABLE \"{$table}\" CASCADE");

            tenancy()->end();

            return response()->json([
                'message' => "Tabla {$table} vaciada correctamente",
            ], 200);
        } catch (\Exception $e) {
            if (tenancy()->initialized) {
                tenancy()->end();
            }

            return response()->json([
                'message' => 'Error al vaciar la tabla: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get plan limits, subscription details, and resource usage for a tenant.
     */
    public function planUsage(string $id)
    {
        $tenant = Tenant::findOrFail($id);
        $limitService = app(\App\Services\TenantLimitService::class);
        $usage = $limitService->getUsage($tenant);
        $plan = $limitService->getActivePlan($tenant);
        $subscription = $limitService->getActiveSubscription($tenant);

        return response()->json([
            'tenant' => [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
            ],
            'plan' => $plan,
            'subscription' => $subscription,
            'usage' => $usage,
        ]);
    }
}
