<?php

namespace App\Services\Siat;

use App\Contracts\SiatSoapClientInterface;
use App\Models\Setting;
use App\Models\SiatCancellationReason;
use App\Models\SiatCufd;
use App\Models\SiatCuis;
use App\Models\SiatEconomicActivity;
use App\Models\SiatLegend;
use App\Models\SiatPaymentMethod;
use App\Models\SiatProductService;
use App\Models\Store;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * SiatService — Capa de negocio SIAT para Inventarya (Fase 3B.1)
 *
 * Responsabilidades:
 *  - Verificar comunicación con el SIN (mensajes sanitizados hacia API).
 *  - Sincronizar fecha/hora oficial y evaluar desfase de reloj.
 *  - Obtener, persistir y renovar CUIS en BD (con bloqueo de concurrencia y tolerancia a fallos).
 *  - Obtener, persistir y renovar CUFD en BD (con transacción atómica y lock).
 *  - Sincronizar y persistir catálogos fiscales (Actividades, Productos/Servicios, Leyendas, Métodos de Pago).
 *  - Evaluar Readiness fiscal completo de Store (separando validez legal de ventana de renovación).
 *
 * Multitenancy y Concurrencia:
 *  - Locks y llaves de caché siempre prefijadas por tenant_id.
 *  - Base de datos como fuente persistente única de verdad.
 */
final class SiatService
{
    public function __construct(
        private readonly SiatSoapClientInterface $client,
        private readonly string                   $tenantId,
    ) {}

    // =========================================================================
    // 1. VERIFICAR COMUNICACIÓN
    // =========================================================================

    /**
     * Verifica conectividad con el SIN.
     * Retorna mensaje controlado hacia el exterior para no exponer trazas internas.
     *
     * @return array{success: bool, code: int|null, message: string}
     */
    public function verificarComunicacion(): array
    {
        try {
            $response = $this->client->verificarComunicacion();
            $inner    = $response['RespuestaVerificarComunicacion'] ?? $response;
            $codes    = $inner['mensajesList'] ?? $inner['codigoDescripcion'] ?? [];

            if (isset($codes['codigo'])) {
                $codes = [$codes];
            }

            $code    = (int) ($codes[0]['codigo'] ?? 0);
            $message = $codes[0]['descripcion'] ?? 'Sin descripcion';
            $ok      = $code === config('siat.communication_ok_code', 926);

            return [
                'success' => $ok,
                'code'    => $code,
                'message' => $ok ? 'Comunicación exitosa con SIAT.' : $message,
            ];
        } catch (\Throwable $e) {
            Log::warning('[SIAT] verificarComunicacion fallida', [
                'tenant' => $this->tenantId,
                'error'  => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'code'    => null,
                'message' => 'No fue posible establecer comunicación con SIAT.',
            ];
        }
    }

    // =========================================================================
    // 2. FECHA/HORA SIAT
    // =========================================================================

    /**
     * Obtiene la fecha/hora oficial del SIN y la compara con la hora local.
     *
     * @return array{siat_datetime: string, local_datetime: string, drift_seconds: int, warning: bool}
     */
    public function sincronizarFechaHora(): array
    {
        $response   = $this->client->sincronizarFechaHora();
        $inner      = $response['RespuestaSincronizarFechaHora'] ?? $response;
        $siatRaw    = $inner['fechaHora'] ?? '';
        $siatCarbon = Carbon::parse($siatRaw);
        $local      = Carbon::now();
        $drift      = (int) abs($siatCarbon->diffInSeconds($local));
        $threshold  = (int) config('siat.time_drift_warning_threshold_seconds', 60);

        if ($drift > $threshold) {
            Log::warning('[SIAT] Desfase horario detectado', [
                'tenant'        => $this->tenantId,
                'drift_seconds' => $drift,
                'siat'          => $siatCarbon->toIso8601String(),
                'local'         => $local->toIso8601String(),
            ]);
        }

        return [
            'siat_datetime'  => $siatCarbon->toIso8601String(),
            'local_datetime' => $local->toIso8601String(),
            'drift_seconds'  => $drift,
            'warning'        => $drift > $threshold,
        ];
    }

    // =========================================================================
    // 3. CUIS (Persistencia, Ventana de Renovación y Concurrencia)
    // =========================================================================

    /**
     * Retorna el CUIS activo y vigente para un punto de venta.
     *
     * Flujo:
     *  1. Buscar en BD el CUIS activo para store/branch/pos.
     *  2. Si está vigente y fuera de la ventana de renovación (5 días), devolverlo.
     *  3. Si está en ventana de renovación, intentar renovar; si falla, mantener el vigente.
     *  4. Si no existe o está expirado, solicitar nuevo obligatoriamente.
     *
     * @param  Store  $store
     * @return array{cuis: string, valid_until: string, from_cache: bool}
     */
    public function getCuis(Store $store): array
    {
        $active = SiatCuis::where('store_id', $store->id)
            ->where('branch_code', (int) $store->sin_branch_code)
            ->where('point_of_sale_code', (int) $store->sin_point_of_sale_code)
            ->where('is_active', true)
            ->latest('created_at')
            ->first();

        if ($active && $active->isValid()) {
            $windowDays = (int) config('siat.cuis_renewal_window_days', 5);

            if (!$active->shouldRenew($windowDays)) {
                return [
                    'cuis'        => $active->cuis,
                    'valid_until' => $active->valid_until->toIso8601String(),
                    'from_cache'  => false,
                ];
            }

            // Está dentro de la ventana de renovación preventiva
            try {
                return $this->refreshCuis($store);
            } catch (\Throwable $e) {
                Log::warning('[SIAT] Renovación preventiva de CUIS falló, manteniendo CUIS vigente', [
                    'tenant' => $this->tenantId,
                    'store'  => $store->id,
                    'error'  => $e->getMessage(),
                ]);

                return [
                    'cuis'        => $active->cuis,
                    'valid_until' => $active->valid_until->toIso8601String(),
                    'from_cache'  => false,
                ];
            }
        }

        return $this->refreshCuis($store);
    }

    /**
     * Fuerza la obtención de un nuevo CUIS desde el SIN, protegiendo con lock
     * y desactivando el anterior solo tras confirmar el nuevo en transacción.
     *
     * @param  Store  $store
     * @return array{cuis: string, valid_until: string, from_cache: bool}
     */
    public function refreshCuis(Store $store): array
    {
        $lockKey = "siat:tenant:{$this->tenantId}:cuis-lock:{$store->id}:{$store->sin_branch_code}:{$store->sin_point_of_sale_code}";
        $lock    = Cache::lock($lockKey, 15);

        return $lock->block(5, function () use ($store) {
            $response = $this->client->obtenerCuis(
                (int) $store->sin_branch_code,
                (int) $store->sin_point_of_sale_code,
            );

            $inner      = $response['RespuestaObtenerCuis'] ?? $response;
            $cuis       = $inner['codigo'] ?? $inner['cuis'] ?? null;
            $validUntil = $inner['fechaVigencia'] ?? '';

            if (empty($cuis)) {
                $desc = $inner['codigoDescripcion'][0]['descripcion'] ?? 'Respuesta vacía';
                throw new RuntimeException("[SIAT] No se pudo obtener CUIS: {$desc}");
            }

            // Atomicidad: desactivar anterior y crear nuevo
            $record = DB::transaction(function () use ($store, $cuis, $validUntil) {
                SiatCuis::where('store_id', $store->id)
                    ->where('branch_code', (int) $store->sin_branch_code)
                    ->where('point_of_sale_code', (int) $store->sin_point_of_sale_code)
                    ->where('is_active', true)
                    ->update(['is_active' => false]);

                return SiatCuis::create([
                    'store_id'           => $store->id,
                    'branch_code'        => (int) $store->sin_branch_code,
                    'point_of_sale_code' => (int) $store->sin_point_of_sale_code,
                    'cuis'               => $cuis,
                    'valid_until'        => Carbon::parse($validUntil),
                    'is_active'          => true,
                ]);
            });

            // Optimización opcional de caché
            $ttl = Carbon::parse($validUntil)->diffInSeconds(now());
            Cache::put($this->cuisCacheKey($store), [
                'cuis'        => $record->cuis,
                'valid_until' => $record->valid_until->toIso8601String(),
            ], max($ttl, 60));

            Log::info('[SIAT] CUIS obtenido/renovado y persistido', [
                'tenant'      => $this->tenantId,
                'store'       => $store->id,
                'cuis_id'     => $record->id,
                'valid_until' => $validUntil,
            ]);

            return [
                'cuis'        => $record->cuis,
                'valid_until' => $record->valid_until->toIso8601String(),
                'from_cache'  => false,
            ];
        });
    }

    // =========================================================================
    // 4. CUFD (Transacción Atómica, Tolerancia a Fallos y Concurrencia)
    // =========================================================================

    /**
     * Retorna el CUFD activo y vigente para un Store.
     * Si está dentro de la ventana de renovación preventiva (60 min), intenta renovar
     * pero preserva el actual si la llamada SOAP falla temporalmente.
     *
     * @param  Store  $store
     * @return SiatCufd
     */
    public function getCufd(Store $store): SiatCufd
    {
        $threshold = (int) config('siat.cufd_renewal_threshold_minutes', 60);

        $active = SiatCufd::where('store_id', $store->id)
            ->where('branch_code', (int) $store->sin_branch_code)
            ->where('point_of_sale_code', (int) $store->sin_point_of_sale_code)
            ->where('is_active', true)
            ->latest('valid_from')
            ->first();

        if ($active && $active->isValid()) {
            if (!$active->shouldRenew($threshold)) {
                return $active;
            }

            // Próximo a vencer: intentar renovación preventiva
            try {
                return $this->refreshCufd($store);
            } catch (\Throwable $e) {
                Log::warning('[SIAT] Renovación preventiva de CUFD falló, manteniendo CUFD vigente', [
                    'tenant' => $this->tenantId,
                    'store'  => $store->id,
                    'error'  => $e->getMessage(),
                ]);
                return $active;
            }
        }

        return $this->refreshCufd($store);
    }

    /**
     * Obtiene un nuevo CUFD desde el SIN y lo persiste atómicamente con lock.
     * Si la llamada SOAP falla, el CUFD anterior no se modifica.
     *
     * @param  Store  $store
     * @return SiatCufd
     */
    public function refreshCufd(Store $store): SiatCufd
    {
        $lockKey = "siat:tenant:{$this->tenantId}:cufd-lock:{$store->id}:{$store->sin_branch_code}:{$store->sin_point_of_sale_code}";
        $lock    = Cache::lock($lockKey, 15);

        return $lock->block(5, function () use ($store) {
            $cuisData = $this->getCuis($store);

            $response = $this->client->obtenerCufd(
                (int) $store->sin_branch_code,
                (int) $store->sin_point_of_sale_code,
                $cuisData['cuis'],
            );

            $inner         = $response['RespuestaObtenerCufd'] ?? $response;
            $cufd          = $inner['codigo']         ?? null;
            $codigoControl = $inner['codigoControl'] ?? null;
            $validUntil    = $inner['fechaVigencia']  ?? null;

            if (empty($cufd)) {
                $desc = $inner['codigoDescripcion'][0]['descripcion'] ?? 'Respuesta vacía';
                throw new RuntimeException("[SIAT] No se pudo obtener CUFD: {$desc}");
            }

            // Atomicidad: desactivar anterior y crear nuevo bajo transacción
            $record = DB::transaction(function () use ($store, $cufd, $codigoControl, $validUntil) {
                SiatCufd::where('store_id', $store->id)
                    ->where('branch_code', (int) $store->sin_branch_code)
                    ->where('point_of_sale_code', (int) $store->sin_point_of_sale_code)
                    ->where('is_active', true)
                    ->update(['is_active' => false]);

                return SiatCufd::create([
                    'store_id'           => $store->id,
                    'branch_code'        => (int) $store->sin_branch_code,
                    'point_of_sale_code' => (int) $store->sin_point_of_sale_code,
                    'cufd'               => $cufd,
                    'control_code'       => $codigoControl,
                    'valid_from'        => now(),
                    'valid_until'       => Carbon::parse($validUntil),
                    'is_active'         => true,
                ]);
            });

            Log::info('[SIAT] CUFD obtenido/renovado y persistido', [
                'tenant'      => $this->tenantId,
                'store'       => $store->id,
                'cufd_id'     => $record->id,
                'valid_until' => $validUntil,
            ]);

            return $record;
        });
    }

    // =========================================================================
    // 5. CATÁLOGOS PARAMÉTRICOS (Persistencia en BD y Optimización de Caché)
    // =========================================================================

    /**
     * Sincroniza y persiste un catálogo oficial del SIN.
     * Si la sincronización falla, el catálogo previo en BD NO se borra.
     *
     * @param  string  $catalogName
     * @param  Store   $store
     * @param  bool    $forceRefresh
     * @return array
     */
    public function getCatalog(string $catalogName, Store $store, bool $forceRefresh = false): array
    {
        $cacheKey = $this->catalogCacheKey($catalogName, $store);

        if (!$forceRefresh) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return $cached;
            }

            // Consultar base de datos antes de acudir al SIN
            $fromDb = $this->loadCatalogFromDb($catalogName);
            if (!empty($fromDb)) {
                $ttl = config("siat.catalog_cache_ttl.{$this->toCamelCaseKey($catalogName)}", 86400);
                Cache::put($cacheKey, $fromDb, $ttl);
                return $fromDb;
            }
        }

        return $this->syncAndPersistCatalog($catalogName, $store, $cacheKey);
    }

    /**
     * Sincroniza desde el SIN y ejecuta upsert atómico en la tabla correspondiente.
     */
    public function syncAndPersistCatalog(string $catalogName, Store $store, ?string $cacheKey = null): array
    {
        $cuisData = $this->getCuis($store);
        $response = $this->client->sincronizarParametrica(
            $catalogName,
            $cuisData['cuis'],
            (int) $store->sin_branch_code,
            (int) $store->sin_point_of_sale_code,
        );

        $inner = null;
        foreach ($response as $key => $val) {
            if (is_array($val) && str_starts_with($key, 'RespuestaSincronizar')) {
                $inner = $val;
                break;
            }
        }
        $inner = $inner ?? $response;

        $items = $inner['listaCodigos']
            ?? $inner['listaActividades']
            ?? $inner['listaLeyendas']
            ?? [];

        if (isset($items['codigo']) || isset($items['codigoCaeb']) || isset($items['codigoProducto']) || isset($items['codigoClasificador'])) {
            $items = [$items];
        }

        // Persistencia atómica por tipo de catálogo
        DB::transaction(function () use ($catalogName, $items) {
            match (strtolower($catalogName)) {
                'actividades' => $this->persistActivities($items),
                'productosservicios', 'productos_servicios' => $this->persistProductServices($items),
                'leyendasfactura', 'leyendas' => $this->persistLegends($items),
                'tipometodopago', 'tipo_metodo_pago' => $this->persistPaymentMethods($items),
                'motivoanulacion', 'motivo_anulacion', 'motivosanulacion' => $this->persistCancellationReasons($items),
                default => null,
            };
        });

        $ttl      = config("siat.catalog_cache_ttl.{$this->toCamelCaseKey($catalogName)}", 86400);
        $cacheKey = $cacheKey ?? $this->catalogCacheKey($catalogName, $store);
        Cache::put($cacheKey, $items, $ttl);

        Log::info('[SIAT] Catálogo sincronizado y persistido', [
            'tenant'   => $this->tenantId,
            'catalogo' => $catalogName,
            'items'    => count($items),
        ]);

        return $items;
    }

    private function persistActivities(array $items): void
    {
        foreach ($items as $item) {
            $code = (string) ($item['codigoCaeb'] ?? $item['codigo'] ?? '');
            $desc = (string) ($item['descripcion'] ?? '');
            $type = isset($item['tipoActividad']) ? (string) $item['tipoActividad'] : null;

            if (!empty($code)) {
                SiatEconomicActivity::updateOrCreate(
                    ['code' => $code],
                    ['description' => $desc, 'activity_type' => $type]
                );
            }
        }
    }

    private function persistProductServices(array $items): void
    {
        foreach ($items as $item) {
            $actCode  = (string) ($item['codigoActividad'] ?? '');
            $prodCode = (int) ($item['codigoProducto'] ?? 0);
            $desc     = (string) ($item['descripcionProducto'] ?? $item['descripcion'] ?? '');
            $nandina  = isset($item['nandina']) ? (string) $item['nandina'] : null;

            if (!empty($actCode) && $prodCode > 0) {
                SiatProductService::updateOrCreate(
                    ['activity_code' => $actCode, 'sin_product_code' => $prodCode],
                    ['description' => $desc, 'nandina' => $nandina]
                );
            }
        }
    }

    private function persistLegends(array $items): void
    {
        foreach ($items as $item) {
            $actCode = (string) ($item['codigoActividad'] ?? '');
            $desc    = (string) ($item['descripcionLeyenda'] ?? $item['descripcion'] ?? '');

            if (!empty($actCode) && !empty($desc)) {
                SiatLegend::firstOrCreate(
                    ['activity_code' => $actCode, 'description' => $desc]
                );
            }
        }
    }

    private function persistPaymentMethods(array $items): void
    {
        foreach ($items as $item) {
            $code = (int) ($item['codigoClasificador'] ?? $item['codigo'] ?? 0);
            $desc = (string) ($item['descripcion'] ?? '');

            if ($code > 0) {
                SiatPaymentMethod::updateOrCreate(
                    ['code' => $code],
                    ['description' => $desc]
                );
            }
        }
    }

    private function persistCancellationReasons(array $items): void
    {
        foreach ($items as $item) {
            $code = (int) ($item['codigoClasificador'] ?? $item['codigo'] ?? 0);
            $desc = (string) ($item['descripcion'] ?? '');

            if ($code > 0) {
                SiatCancellationReason::updateOrCreate(
                    ['code' => $code],
                    ['description' => $desc]
                );
            }
        }
    }

    private function loadCatalogFromDb(string $catalogName): array
    {
        return match (strtolower($catalogName)) {
            'actividades' => SiatEconomicActivity::all()->map(fn ($r) => [
                'codigoCaeb'    => $r->code,
                'descripcion'   => $r->description,
                'tipoActividad' => $r->activity_type,
            ])->toArray(),
            'productosservicios', 'productos_servicios' => SiatProductService::all()->map(fn ($r) => [
                'codigoActividad'     => $r->activity_code,
                'codigoProducto'      => $r->sin_product_code,
                'descripcionProducto' => $r->description,
                'nandina'             => $r->nandina,
            ])->toArray(),
            'leyendasfactura', 'leyendas' => SiatLegend::all()->map(fn ($r) => [
                'codigoActividad'    => $r->activity_code,
                'descripcionLeyenda' => $r->description,
            ])->toArray(),
            'tipometodopago', 'tipo_metodo_pago' => SiatPaymentMethod::all()->map(fn ($r) => [
                'codigoClasificador' => $r->code,
                'descripcion'        => $r->description,
            ])->toArray(),
            'motivoanulacion', 'motivo_anulacion', 'motivosanulacion' => SiatCancellationReason::orderBy('code')->get()->map(fn ($r) => [
                'codigoClasificador' => $r->code,
                'descripcion'        => $r->description,
            ])->toArray(),
            default => [],
        };
    }

    // =========================================================================
    // 6. PREPARACIÓN FISCAL DE UN STORE (Readiness)
    // =========================================================================

    /**
     * Evalúa si una Store está fiscalmente lista para operar.
     * Separa la validez legal (valid_until > now()) de la ventana de renovación preventiva.
     *
     * @param  Store    $store
     * @param  Setting  $setting
     * @return array{ready: bool, issues: string[]}
     */
    public function storeIsReady(Store $store, Setting $setting): array
    {
        return (new SiatReadinessService())->storeReadiness($store, $setting);
    }

    // =========================================================================
    // Privados: Llaves de Caché
    // =========================================================================

    private function cuisCacheKey(Store $store): string
    {
        return "siat:tenant:{$this->tenantId}:cuis:{$store->id}:{$store->sin_branch_code}:{$store->sin_point_of_sale_code}";
    }

    private function catalogCacheKey(string $catalogName, Store $store): string
    {
        return "siat:tenant:{$this->tenantId}:catalog:{$catalogName}:{$store->sin_branch_code}:{$store->sin_point_of_sale_code}";
    }

    private function toCamelCaseKey(string $catalogName): string
    {
        $snake = preg_replace('/(?<!^)[A-Z]/', '_$0', $catalogName) ?? $catalogName;
        return strtolower($snake);
    }
}
