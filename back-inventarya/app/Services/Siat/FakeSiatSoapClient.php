<?php

namespace App\Services\Siat;

use App\Contracts\SiatSoapClientInterface;

/**
 * Doble de prueba del cliente SOAP SIAT.
 *
 * Permite testear la lógica de negocio de SiatService sin realizar llamadas
 * reales al SIN.  Se pueden pre-cargar respuestas y errores específicos por
 * operación para cubrir todos los escenarios relevantes.
 */
final class FakeSiatSoapClient implements SiatSoapClientInterface
{
    /** @var array<string, mixed> Respuestas indexadas por nombre de operación */
    private array $responses = [];

    /** @var array<string, \Throwable> Errores indexados por nombre de operación */
    private array $errors = [];

    /** @var array<string, mixed> Log de llamadas realizadas */
    private array $calls = [];

    // -------------------------------------------------------------------------
    // API de configuración del fake (para tests)
    // -------------------------------------------------------------------------

    /**
     * Pre-carga la respuesta que se devolverá para una operación.
     */
    public function willReturn(string $operation, array $response): static
    {
        $this->responses[$operation] = $response;
        return $this;
    }

    /**
     * Pre-carga un error que se lanzará para una operación.
     */
    public function willThrow(string $operation, \Throwable $error): static
    {
        $this->errors[$operation] = $error;
        return $this;
    }

    /**
     * Retorna todas las llamadas registradas.
     *
     * @return array<string, mixed>
     */
    public function recordedCalls(): array
    {
        return $this->calls;
    }

    /**
     * Verifica que la operación fue llamada al menos una vez.
     */
    public function wasCalled(string $operation): bool
    {
        return array_key_exists($operation, $this->calls);
    }

    // -------------------------------------------------------------------------
    // SiatSoapClientInterface
    // -------------------------------------------------------------------------

    public function verificarComunicacion(): array
    {
        return $this->dispatch('verificarComunicacion', [], fn () => [
            'RespuestaVerificarComunicacion' => [
                'transaccion'        => true,
                'codigoDescripcion'  => [
                    ['codigo' => 926, 'descripcion' => 'COMUNICACIÓN EXITOSA'],
                ],
            ],
        ]);
    }

    public function sincronizarFechaHora(): array
    {
        return $this->dispatch('sincronizarFechaHora', [], fn () => [
            'RespuestaSincronizarFechaHora' => [
                'fechaHora' => now()->format('Y-m-d\TH:i:s.v'),
            ],
        ]);
    }

    public function obtenerCuis(int $codigoSucursal, int $codigoPuntoVenta): array
    {
        return $this->dispatch('obtenerCuis', compact('codigoSucursal', 'codigoPuntoVenta'), fn () => [
            'RespuestaObtenerCuis' => [
                'transaccion'        => true,
                'codigo'             => 'CUIS-FAKE-' . $codigoSucursal . '-' . $codigoPuntoVenta,
                'fechaVigencia'      => now()->addYear()->format('Y-m-d\TH:i:s.v'),
                'codigoDescripcion'  => [
                    ['codigo' => 0, 'descripcion' => 'CUIS GENERADO'],
                ],
            ],
        ]);
    }

    public function obtenerCufd(int $codigoSucursal, int $codigoPuntoVenta, string $cuis): array
    {
        return $this->dispatch('obtenerCufd', compact('codigoSucursal', 'codigoPuntoVenta', 'cuis'), fn () => [
            'RespuestaObtenerCufd' => [
                'transaccion'        => true,
                'codigo'             => 'CUFD-FAKE-' . $codigoSucursal . '-' . $codigoPuntoVenta . '-' . \Illuminate\Support\Str::random(8),
                'codigoControl'      => 'CTRL-FAKE-12345678',
                'fechaVigencia'      => now()->addHours(24)->format('Y-m-d\TH:i:s.v'),
                'codigoDescripcion'  => [
                    ['codigo' => 0, 'descripcion' => 'CUFD GENERADO'],
                ],
            ],
        ]);
    }

    public function sincronizarParametrica(
        string $catalogName,
        string $cuis,
        int    $codigoSucursal,
        int    $codigoPuntoVenta,
    ): array {
        $opKey = 'sincronizarParametrica:' . $catalogName;

        return $this->dispatch(
            $opKey,
            compact('catalogName', 'cuis', 'codigoSucursal', 'codigoPuntoVenta'),
            function () use ($catalogName) {
                if (strcasecmp($catalogName, 'Actividades') === 0) {
                    return [
                        'RespuestaSincronizarActividades' => [
                            'transaccion' => true,
                            'listaActividades' => [
                                [
                                    'codigoCaeb'    => '47111',
                                    'descripcion'   => 'VENTA AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS',
                                    'tipoActividad' => 'P',
                                ],
                            ],
                        ],
                    ];
                }

                if (strcasecmp($catalogName, 'ProductosServicios') === 0) {
                    return [
                        'RespuestaSincronizarListaProductosServicios' => [
                            'transaccion' => true,
                            'listaCodigos' => [
                                [
                                    'codigoActividad'     => '47111',
                                    'codigoProducto'      => 99100,
                                    'descripcionProducto' => 'SERVICIOS DE VENTA AL POR MENOR',
                                    'nandina'             => null,
                                ],
                            ],
                        ],
                    ];
                }

                if (strcasecmp($catalogName, 'LeyendasFactura') === 0) {
                    return [
                        'RespuestaSincronizarListaLeyendasFactura' => [
                            'transaccion' => true,
                            'listaLeyendas' => [
                                [
                                    'codigoActividad'    => '47111',
                                    'descripcionLeyenda' => 'Ley N° 453: Los servicios deben prestarse en condiciones de calidad.',
                                ],
                            ],
                        ],
                    ];
                }

                if (strcasecmp($catalogName, 'TipoMetodoPago') === 0) {
                    return [
                        'RespuestaSincronizarParametricaTipoMetodoPago' => [
                            'transaccion' => true,
                            'listaCodigos' => [
                                ['codigoClasificador' => 1, 'descripcion' => 'EFECTIVO'],
                                ['codigoClasificador' => 2, 'descripcion' => 'TARJETA DE DEBITO'],
                            ],
                        ],
                    ];
                }

                if (strcasecmp($catalogName, 'MotivoAnulacion') === 0 || strcasecmp($catalogName, 'motivo_anulacion') === 0) {
                    return [
                        'RespuestaSincronizarParametricaMotivoAnulacion' => [
                            'transaccion' => true,
                            'listaCodigos' => [
                                ['codigoClasificador' => 1, 'descripcion' => 'FACTURA MAL EMITIDA'],
                                ['codigoClasificador' => 2, 'descripcion' => 'NOTA DE CREDITO-DEBITO MAL EMITIDA'],
                                ['codigoClasificador' => 3, 'descripcion' => 'DATOS DE EMISION INCORRECTOS'],
                                ['codigoClasificador' => 4, 'descripcion' => 'FACTURA O NOTA DEVOLUCION'],
                            ],
                        ],
                    ];
                }

                return [
                    'RespuestaSincronizarParametrica' . ucfirst($catalogName) => [
                        'transaccion'  => true,
                        'listaCodigos' => [],
                    ],
                ];
            }
        );
    }

    public function recepcionFactura(array $solicitud): array
    {
        return $this->dispatch('recepcionFactura', compact('solicitud'), fn () => [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 908, // VALIDADA / ACEPTADA
                'codigoRecepcion'   => 'REC-' . \Illuminate\Support\Str::uuid()->toString(),
                'codigoDescripcion' => 'VALIDADA',
                'mensajesList'      => [],
            ],
        ]);
    }

    public function verificacionEstadoFactura(array $solicitud): array
    {
        return $this->dispatch('verificacionEstadoFactura', compact('solicitud'), fn () => [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 908, // VALIDADA
                'codigoRecepcion'   => 'REC-VERIFY-' . \Illuminate\Support\Str::uuid()->toString(),
                'codigoDescripcion' => 'VALIDADA',
                'mensajesList'      => [],
            ],
        ]);
    }

    public function anulacionFactura(array $solicitud): array
    {
        return $this->dispatch('anulacionFactura', compact('solicitud'), fn () => [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 905, // ANULACIÓN CONFIRMADA
                'codigoRecepcion'   => 'REC-CANCEL-' . \Illuminate\Support\Str::uuid()->toString(),
                'codigoDescripcion' => 'ANULACION CONFIRMADA',
                'mensajesList'      => [],
            ],
        ]);
    }

    public function reversionAnulacionFactura(array $solicitud): array
    {
        return $this->dispatch('reversionAnulacionFactura', compact('solicitud'), fn () => [
            'RespuestaServicioFacturacion' => [
                'transaccion'       => true,
                'codigoEstado'      => 907, // REVERSIÓN DE ANULACIÓN CONFIRMADA
                'codigoRecepcion'   => 'REC-REVERSE-' . \Illuminate\Support\Str::uuid()->toString(),
                'codigoDescripcion' => 'REVERSION DE ANULACION CONFIRMADA',
                'mensajesList'      => [],
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Privados
    // -------------------------------------------------------------------------

    private function dispatch(string $operation, array $args, \Closure $default): array
    {
        $this->calls[$operation] = $args;

        if (isset($this->errors[$operation])) {
            throw $this->errors[$operation];
        }

        return $this->responses[$operation] ?? $default();
    }
}
