<?php

return [

    /*
    |--------------------------------------------------------------------------
    | SIAT SOAP Endpoints — Servicio de Impuestos Nacionales (SIN) Bolivia
    |--------------------------------------------------------------------------
    |
    | Ambiente 1 = PRODUCCIÓN  → siatservicios.impuestos.gob.bo
    | Ambiente 2 = PILOTO      → pilotosiatservicios.impuestos.gob.bo
    |
    | Solo URLs públicas. Las credenciales tenant se cargan desde Settings.
    |
    */

    'endpoints' => [

        1 => [ // PRODUCCIÓN
            'facturacion_codigos'        => 'https://siatservicios.impuestos.gob.bo/v2/FacturacionCodigos?wsdl',
            'facturacion_sincronizacion' => 'https://siatservicios.impuestos.gob.bo/v2/FacturacionSincronizacion?wsdl',
            'facturacion_compra_venta'   => 'https://siatservicios.impuestos.gob.bo/v2/ServicioFacturacionCompraVenta?wsdl',
        ],

        2 => [ // PILOTO / PRUEBAS
            'facturacion_codigos'        => 'https://pilotosiatservicios.impuestos.gob.bo/v2/FacturacionCodigos?wsdl',
            'facturacion_sincronizacion' => 'https://pilotosiatservicios.impuestos.gob.bo/v2/FacturacionSincronizacion?wsdl',
            'facturacion_compra_venta'   => 'https://pilotosiatservicios.impuestos.gob.bo/v2/ServicioFacturacionCompraVenta?wsdl',
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | SOAP Client Options
    |--------------------------------------------------------------------------
    */

    'soap' => [
        'connection_timeout' => 10,
        'timeout'            => 20,
        'cache_wsdl'         => defined('WSDL_CACHE_BOTH') ? WSDL_CACHE_BOTH : 3,
        'exceptions'         => true,
        'trace'              => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | Kill Switch — Transmisión Real al SIN
    |--------------------------------------------------------------------------
    |
    | Bloquea toda transmisión real al SIN a menos que esté explícitamente
    | habilitada por variable de entorno (por defecto FALSE en todo entorno).
    |
    */

    'live_submission_enabled' => (bool) env('SIAT_LIVE_SUBMISSION_ENABLED', false),

    /*
    |--------------------------------------------------------------------------
    | Umbrales de Renovación
    |--------------------------------------------------------------------------
    |
    | cufd_renewal_threshold_minutes: si quedan menos de N minutos para el
    |   vencimiento del CUFD activo, se obtiene uno nuevo antes de usarlo.
    |
    | cuis_renewal_window_days: días antes del vencimiento del CUIS en que
    |   puede renovarse anticipadamente (5 días según RND 102100000011 Art. 11 II).
    |
    */

    'cufd_renewal_threshold_minutes' => 60,
    'cuis_renewal_window_days'        => 5,

    /*
    |--------------------------------------------------------------------------
    | Código de Comunicación OK
    |--------------------------------------------------------------------------
    |
    | El SIN devuelve el código 926 cuando verificarComunicacion es exitosa.
    |
    */

    'communication_ok_code' => 926,

    /*
    |--------------------------------------------------------------------------
    | TTL de Caché por tipo de catálogo (segundos)
    |--------------------------------------------------------------------------
    |
    | Los catálogos SIAT no cambian con frecuencia. Se cachean localmente
    | para evitar llamadas SOAP repetitivas. Cada tenant tiene su propia llave.
    |
    */

    'catalog_cache_ttl' => [
        'tipo_metodo_pago'              => 86400,  // 24 h
        'tipo_documento_identidad'      => 86400,
        'tipo_documento_sector'         => 86400,
        'actividades_documento_sector'  => 86400,
        'productos_servicios'           => 86400,
        'unidades_medida'               => 86400,
        'tipo_moneda'                   => 86400,
        'motivo_anulacion'              => 86400 * 7,
        'paises'                        => 86400 * 7,
    ],

    /*
    |--------------------------------------------------------------------------
    | Código QR Fiscal — URLs de Consulta SIN (RND 102100000011)
    |--------------------------------------------------------------------------
    |
    | Ambiente 1 = PRODUCCIÓN (URL comunicada oficialmente al finalizar la autorización)
    | Ambiente 2 = PILOTO      → https://pilotosiat.impuestos.gob.bo/consulta/QR
    |
    | AVISO NORMATIVO: La URL definitiva de consulta QR en ambiente de producción
    | NO debe asumirse como un supuesto fiscal confirmado e irreversible. Conforme
    | a la normativa del SIN, la URL productiva oficial es comunicada por la
    | administración tributaria al concluir la fase de pruebas/autorización del sistema.
    | Por tal motivo, es parametrizable vía SIAT_QR_URL_PRODUCCION o configuración
    | de homologación del contribuyente.
    |
    */

    'qr_urls' => [
        1 => env('SIAT_QR_URL_PRODUCCION', 'https://siat.impuestos.gob.bo/consulta/QR'),
        2 => env('SIAT_QR_URL_PILOTO', 'https://pilotosiat.impuestos.gob.bo/consulta/QR'),
    ],

];
