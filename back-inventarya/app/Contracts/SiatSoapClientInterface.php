<?php

namespace App\Contracts;

/**
 * Contrato para el cliente SOAP que se comunica con el SIN/SIAT.
 *
 * La separación en interfaz permite inyectar un doble de prueba en los tests
 * sin necesidad de contactar los servidores reales del SIN.
 */
interface SiatSoapClientInterface
{
    /**
     * Verifica la conectividad con el servidor SIAT.
     * Operación: verificarComunicacion
     *
     * @return array{transaccion: bool, codigoDescripcion: array{codigo: int, descripcion: string}}
     */
    public function verificarComunicacion(): array;

    /**
     * Obtiene la hora oficial del servidor SIAT.
     * Operación: sincronizarFechaHora
     *
     * @return array{fecha: string, hora: string}
     */
    public function sincronizarFechaHora(): array;

    /**
     * Obtiene o renueva el Código Único de Inicio de Sistema (CUIS).
     * Operación: obtenerCuis
     *
     * @param  int  $codigoSucursal     Código de sucursal SIN
     * @param  int  $codigoPuntoVenta   Código de punto de venta SIN
     * @return array{cuis: string, fechaVigencia: string, codigoDescripcion: array}
     */
    public function obtenerCuis(int $codigoSucursal, int $codigoPuntoVenta): array;

    /**
     * Obtiene el Código Único de Facturación Diaria (CUFD).
     * Operación: obtenerCufd
     *
     * @param  int     $codigoSucursal
     * @param  int     $codigoPuntoVenta
     * @param  string  $cuis             CUIS vigente del punto de venta
     * @return array{codigo: string, codigoControl: string, fechaVigencia: string, codigoDescripcion: array}
     */
    public function obtenerCufd(int $codigoSucursal, int $codigoPuntoVenta, string $cuis): array;

    /**
     * Sincroniza un catálogo paramétrico del SIN.
     * Operación: sincronizarParametrica<Nombre>
     *
     * @param  string  $catalogName  Nombre del catálogo (ej. 'TipoMetodoPago')
     * @param  string  $cuis
     * @param  int     $codigoSucursal
     * @param  int     $codigoPuntoVenta
     * @return array
     */
    public function sincronizarParametrica(
        string $catalogName,
        string $cuis,
        int    $codigoSucursal,
        int    $codigoPuntoVenta,
    ): array;

    /**
     * Envía una Factura Compra-Venta individual al SIN.
     * Operación: recepcionFactura (ServicioFacturacionCompraVenta)
     *
     * @param  array  $solicitud  Parámetros de SolicitudServicioRecepcionFactura
     * @return array  RespuestaServicioFacturacion normalizada
     */
    public function recepcionFactura(array $solicitud): array;

    /**
     * Consulta el estado oficial de una factura previamente emitida ante el SIN.
     * Operación: verificacionEstadoFactura (ServicioFacturacionCompraVenta)
     *
     * @param  array  $solicitud  Parámetros de SolicitudServicioVerificacionEstadoFactura
     * @return array  RespuestaServicioFacturacion normalizada
     */
    public function verificacionEstadoFactura(array $solicitud): array;

    /**
     * Anula fiscalmente una Factura Compra-Venta previamente validada ante el SIN.
     * Operación: anulacionFactura (ServicioFacturacionCompraVenta)
     *
     * @param  array  $solicitud  Parámetros de SolicitudServicioAnulacionFactura
     * @return array  RespuestaServicioFacturacion normalizada
     */
    public function anulacionFactura(array $solicitud): array;

    /**
     * Revierte por única vez la anulación fiscal de una Factura Compra-Venta ante el SIN.
     * Operación: reversionAnulacionFactura (ServicioFacturacionCompraVenta)
     *
     * @param  array  $solicitud  Parámetros de SolicitudServicioReversionAnulacionFactura
     * @return array  RespuestaServicioFacturacion normalizada
     */
    public function reversionAnulacionFactura(array $solicitud): array;
}

