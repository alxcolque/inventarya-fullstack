<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRequest;
use App\Models\Assignment;
use App\Models\Store;
use App\Services\FileStorageService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class StoreController extends Controller
{
    private const FOLDER_PATH = 'inventory/stores';

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $this->ensureApiColumnsExist();
        $user = Auth::user();
        
        if ($user && $user->can('stores:view-all')) {
            $stores = Store::orderBy('name', 'asc')->get();
        } else {
            $assignments = Assignment::where('user_id', $user?->id)->get();
            $storesIds = $assignments->pluck('store_id')->toArray();
            $stores = Store::whereIn('id', $storesIds)->orderBy('name', 'asc')->get();
        }

        if ($user && $user->role === 'owner') {
            $stores->transform(function ($store) {
                $store->has_api_secret = ! empty($store->api_secret);

                return $store;
            });
        }

        return response()->json($stores);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreRequest $request)
    {
        $this->ensureApiColumnsExist();
        if ($request->user()?->cannot('stores:create')) {
            return response()->json([
                'error' => 'No autorizado. Solo el propietario puede crear tiendas.',
            ], 403);
        }

        $tenant = tenant();
        if ($tenant) {
            $check = app(\App\Services\TenantLimitService::class)->canCreateStore($tenant);
            if (!$check['allowed']) {
                return response()->json([
                    'code' => $check['code'] ?? 'PLAN_LIMIT_REACHED',
                    'message' => $check['message'] ?? 'Has alcanzado el límite de tiendas de tu plan.',
                    'limit' => $check['limit'] ?? null,
                    'current' => $check['current'] ?? null,
                ], 422);
            }
        }

        $data = $request->validated();
        if (!isset($data['is_active'])) {
            $data['is_active'] = true;
        }

        $newImagePath = null;
        if (! empty($data['front_image']) && FileStorageService::isNewUpload($data['front_image'])) {
            try {
                $upload = FileStorageService::upload($data['front_image'], self::FOLDER_PATH);
                $newImagePath = $upload['path'];
                $data['front_image'] = $newImagePath;
                $data['front_image_key'] = $newImagePath;
            } catch (\Throwable $exception) {
                return response()->json(['message' => 'No se pudo subir la imagen: '.$exception->getMessage()], 422);
            }
        } elseif (! empty($data['front_image']) && FileStorageService::isManagedReference($data['front_image'])) {
            $data['front_image'] = FileStorageService::normalizePath($data['front_image']);
            $data['front_image_key'] = $data['front_image'];
        }

        $slug = $this->uniqueSlug($data['name']);
        $data['slug'] = $slug;
        try {
            $store = Store::create($data);
        } catch (\Throwable $exception) {
            if ($newImagePath) {
                FileStorageService::delete($newImagePath);
            }
            throw $exception;
        }

        return response()->json([
            'message' => 'Tienda creada correctamente',
            'store' => $store,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        if (empty($id) || $id === 'NaN' || (!Str::isUuid($id) && !is_numeric($id))) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        $user = Auth::user();

        if ($user && $user->can('stores:view-all')) {
            $store = Store::find($id);
        } else {
            $assignments = Assignment::where('user_id', $user?->id)->get();
            $storesIds = $assignments->pluck('store_id')->toArray();
            $store = Store::whereIn('id', $storesIds)->find($id);
        }

        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        if ($user && $user->role === 'owner') {
            $store->has_api_secret = !empty($store->api_secret);
        }

        return response()->json([
            'shop' => $store,
        ], 200);
    }

    /**
     * Get store by slug
     */
    public function getStoreBySlug($slug)
    {
        $slugWithHyphen = str_replace('_', '-', $slug);
        $slugWithUnderscore = str_replace('-', '_', $slug);

        $storeQuery = Store::where('slug', $slug)
            ->orWhere('slug', $slugWithHyphen)
            ->orWhere('slug', $slugWithUnderscore);

        if (\Illuminate\Support\Str::isUuid($slug)) {
            $storeQuery->orWhere('id', $slug);
        }

        $store = $storeQuery->first();

        if (! $store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        return response()->json([
            'store' => $store,
        ], 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(StoreRequest $request, $id)
    {
        $this->ensureApiColumnsExist();
        if (Auth::user()?->cannot('stores:update')) {
            return response()->json([
                'error' => 'No autorizado. Solo el propietario puede actualizar tiendas.',
            ], 403);
        }

        $data = $request->validated();
        $store = Store::find($id);
        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        $oldImagePath = $store->front_image_key ?: $store->getRawOriginal('front_image');
        $newImagePath = null;
        $replaceImage = false;

        if (array_key_exists('front_image', $data)) {
            $imageInput = $data['front_image'];
            unset($data['front_image']);

            if (empty($imageInput) || $imageInput === 'delete' || $imageInput === 'null') {
                $data['front_image'] = null;
                $data['front_image_key'] = null;
                $replaceImage = true;
            } elseif (FileStorageService::isNewUpload($imageInput)) {
                try {
                    $upload = FileStorageService::upload($imageInput, self::FOLDER_PATH);
                    $newImagePath = $upload['path'];
                    $data['front_image'] = $newImagePath;
                    $data['front_image_key'] = $newImagePath;
                    $replaceImage = true;
                } catch (\Throwable $exception) {
                    return response()->json(['message' => 'No se pudo subir la imagen: '.$exception->getMessage()], 422);
                }
            } elseif (FileStorageService::isManagedReference($imageInput)
                && ! FileStorageService::referencesMatch($imageInput, $oldImagePath)) {
                $data['front_image'] = FileStorageService::normalizePath($imageInput);
                $data['front_image_key'] = $data['front_image'];
                $replaceImage = true;
            } elseif (filter_var($imageInput, FILTER_VALIDATE_URL) && $imageInput !== $store->front_image) {
                $data['front_image'] = $imageInput;
                $data['front_image_key'] = null;
                $replaceImage = true;
            }
        }
        if ($store->name !== $data['name']) {
            $slug = $this->uniqueSlug($data['name']);
            $data['slug'] = $slug;
        }

        try {
            $store->update($data);
        } catch (\Throwable $exception) {
            if ($newImagePath) {
                FileStorageService::delete($newImagePath);
            }
            throw $exception;
        }

        if ($replaceImage && $oldImagePath && ! FileStorageService::referencesMatch($oldImagePath, $newImagePath)) {
            FileStorageService::delete($oldImagePath);
        }

        return response()->json([
            'message' => 'Tienda actualizada correctamente',
            'store' => $store,
        ], 200);
    }

    public function uniqueSlug($name)
    {
        $slug = Str::slug($name);
        $exist = Store::where('slug', $slug)->first();
        if ($exist) {
            $slug = $this->uniqueSlug($name.'-'.($exist->id + 1));
        }

        return $slug;
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        if (Auth::user()?->cannot('stores:delete')) {
            return response()->json([
                'error' => 'No autorizado. Solo el propietario puede eliminar tiendas.',
            ], 403);
        }

        $store = Store::find($id);
        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        $oldImagePath = $store->front_image_key ?: $store->getRawOriginal('front_image');
        $store->delete();
        FileStorageService::delete($oldImagePath);

        return response()->json([
            'message' => 'Tienda eliminada correctamente',
        ], 200);
    }

    /**
     * Garantiza de forma resiliente que las columnas api_status, api_key, api_secret
     * y flags de carrito existan en la tabla física stores del tenant actual.
     */
    private function ensureApiColumnsExist(): void
    {
        try {
            if (!Schema::hasTable('stores')) {
                return;
            }

            $columns = [
                'api_status' => ['type' => 'boolean', 'default' => false],
                'api_key' => ['type' => 'string', 'nullable' => true],
                'api_secret' => ['type' => 'string', 'nullable' => true],
                'enable_customers' => ['type' => 'boolean', 'default' => false],
                'enable_payment' => ['type' => 'boolean', 'default' => false],
                'enable_observations' => ['type' => 'boolean', 'default' => false],
                'enable_discount' => ['type' => 'boolean', 'default' => false],
            ];

            foreach ($columns as $column => $def) {
                if (!Schema::hasColumn('stores', $column)) {
                    try {
                        Schema::table('stores', function (Blueprint $table) use ($column, $def) {
                            if ($def['type'] === 'boolean') {
                                $table->boolean($column)->default($def['default']);
                            } else {
                                $table->string($column)->nullable();
                            }
                        });
                    } catch (\Throwable $t) {
                        // Ignorar si ya fue agregada concurrentemente
                    }
                }
            }
        } catch (\Throwable $e) {
            // Ignorar si no hay permisos de alter table
        }
    }

    /**
     * Consulta el estado y credenciales públicas de la API para una tienda específica.
     * Restringido exclusivamente al dueño del sistema.
     */
    public function getApiCredentials(Request $request, $id)
    {
        if ($request->user()?->role !== 'owner') {
            return response()->json([
                'status' => 'error',
                'message' => 'No autorizado. Solo el dueño del sistema puede ver la configuración de la API.',
            ], 403);
        }

        $this->ensureApiColumnsExist();
        $store = Store::find($id);

        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        return response()->json([
            'status'         => 'success',
            'store_id'       => $store->id,
            'store_name'     => $store->name,
            'api_status'     => (bool) $store->api_status,
            'api_key'        => $store->api_key,
            'has_api_secret' => !empty($store->api_secret),
        ], 200);
    }

    /**
     * Genera o regenera credenciales seguras (api_key y api_secret) para la tienda.
     * Restringido exclusivamente al dueño del sistema.
     * Retorna api_secret en texto claro ÚNICAMENTE en esta respuesta.
     */
    public function generateApiCredentials(Request $request, $id)
    {
        if ($request->user()?->role !== 'owner') {
            return response()->json([
                'status' => 'error',
                'message' => 'No autorizado. Solo el dueño del sistema puede generar credenciales de API.',
            ], 403);
        }

        $this->ensureApiColumnsExist();
        $store = Store::find($id);

        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        // Generamos llaves seguras y largas
        $rawKey = 'pk_' . Str::random(32);    // Public Key (ej: pk_7f8g9...)
        $rawSecret = 'sk_' . Str::random(48); // Secret Key (ej: sk_2m3n4...)

        $store->update([
            'api_status' => true, // Activada automáticamente al generar
            'api_key'    => $rawKey,
            'api_secret' => Hash::make($rawSecret), // Almacenamiento seguro cifrado con Hash
        ]);

        // Retornamos los valores limpios SOLO ESTA VEZ para que el dueño los copie
        return response()->json([
            'status'         => 'success',
            'message'        => 'Credenciales generadas exitosamente. Guarde su Secret Key ahora, no se volverá a mostrar.',
            'store_id'       => $store->id,
            'store_name'     => $store->name,
            'api_status'     => true,
            'api_key'        => $rawKey,
            'api_secret'     => $rawSecret,
            'has_api_secret' => true,
        ], 200);
    }

    /**
     * Alterna el interruptor api_status (true/false) para la tienda sin alterar las credenciales.
     * Restringido exclusivamente al dueño del sistema.
     */
    public function toggleApiStatus(Request $request, $id)
    {
        if ($request->user()?->role !== 'owner') {
            return response()->json([
                'status' => 'error',
                'message' => 'No autorizado. Solo el dueño del sistema puede administrar el estado de la API.',
            ], 403);
        }

        $this->ensureApiColumnsExist();
        $store = Store::find($id);

        if (!$store) {
            return response()->json(['message' => 'Tienda no encontrada'], 404);
        }

        $request->validate([
            'api_status' => 'required|boolean',
        ]);

        $newStatus = $request->boolean('api_status');

        if ($newStatus && empty($store->api_key)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Debe generar credenciales de API antes de habilitar el servicio.',
            ], 422);
        }

        $store->update([
            'api_status' => $newStatus,
        ]);

        return response()->json([
            'status'     => 'success',
            'message'    => $newStatus ? 'API externa habilitada correctamente' : 'API externa deshabilitada',
            'api_status' => (bool) $store->api_status,
            'api_key'    => $store->api_key,
        ], 200);
    }
}
