<?php

namespace App\Services\Siat;

use App\Enums\ElectronicInvoiceStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use App\Models\ElectronicInvoiceDetail;
use App\Models\Setting;
use Carbon\Carbon;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class SiatInvoiceXmlBuilder
{
    private readonly SiatXmlSigner $xmlSigner;
    private readonly SiatXmlSignatureValidator $sigValidator;
    private readonly SiatCertificateService $certService;

    public function __construct(
        private readonly SiatInvoiceXmlValidator $xmlValidator,
        ?SiatXmlSigner $xmlSigner = null,
        ?SiatXmlSignatureValidator $sigValidator = null,
        ?SiatCertificateService $certService = null,
    ) {
        $this->xmlSigner   = $xmlSigner ?? new SiatXmlSigner();
        $this->sigValidator = $sigValidator ?? new SiatXmlSignatureValidator();
        $this->certService = $certService ?? new SiatCertificateService();
    }

    /**
     * Construye el documento XML en memoria para Factura Compra-Venta (Sector 1)
     * a partir exclusivamente del snapshot inmutable de ElectronicInvoice.
     *
     * @throws SiatFiscalException
     */
    public function build(ElectronicInvoice $invoice): string
    {
        $this->validatePrerequisites($invoice);

        $dom = new DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;

        $modality = (int) $invoice->siat_modality;
        $isElectronica = ($modality === 1);

        $rootName = $isElectronica ? 'facturaElectronicaCompraVenta' : 'facturaComputarizadaCompraVenta';
        $xsdFile  = $isElectronica ? 'facturaElectronicaCompraVenta.xsd' : 'facturaComputarizadaCompraVenta.xsd';

        $root = $dom->createElement($rootName);
        $root->setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $root->setAttribute('xsi:noNamespaceSchemaLocation', $xsdFile);
        $dom->appendChild($root);

        // 1. Cabecera
        $cabecera = $dom->createElement('cabecera');
        $root->appendChild($cabecera);

        $this->buildCabecera($dom, $cabecera, $invoice);

        // 2. Detalle
        $details = $invoice->details;
        if (! $details || $details->isEmpty()) {
            throw new SiatFiscalException("La factura fiscal ID '{$invoice->id}' no cuenta con líneas de detalle.");
        }

        foreach ($details as $detail) {
            $detalle = $dom->createElement('detalle');
            $root->appendChild($detalle);
            $this->buildDetalle($dom, $detalle, $detail);
        }

        $xmlString = $dom->saveXML();
        if ($xmlString === false) {
            throw new SiatFiscalException("Error al serializar el documento XML.");
        }

        return $xmlString;
    }

    /**
     * Construye, valida localmente contra XSD oficial, firma (si es Modalidad 1)
     * y persiste el XML atómicamente.
     *
     * @param  ElectronicInvoice  $invoice
     * @param  string|null        $tenantId
     * @param  array|null         $certOverride Datos de certificado para testing o inyección directa
     * @return array{xml_path: string, already_existed: bool, xml_content: string, is_signed: bool}
     *
     * @throws SiatFiscalException
     */
    public function buildAndPersist(
        ElectronicInvoice $invoice,
        ?string $tenantId = null,
        ?array $certOverride = null
    ): array {
        $disk = Storage::disk(config('filesystems.default', 'local'));

        // Idempotencia dentro de transacción
        return DB::transaction(function () use ($invoice, $disk, $tenantId, $certOverride) {
            /** @var ElectronicInvoice $locked */
            $locked   = ElectronicInvoice::where('id', $invoice->id)->lockForUpdate()->firstOrFail();
            $modality = (int) $locked->siat_modality;

            // Si ya tiene xml_path persistido
            if (! empty($locked->xml_path)) {
                if ($disk->exists($locked->xml_path)) {
                    $existingXml = (string) $disk->get($locked->xml_path);

                    if ($modality === 1) {
                        $details = $this->sigValidator->validateDetails($existingXml);
                        if ($details['is_valid']) {
                            return [
                                'xml_path'                => $locked->xml_path,
                                'already_existed'         => true,
                                'xml_content'             => $existingXml,
                                'is_signed'               => true,
                                'certificate_fingerprint' => $details['certificate_fingerprint'],
                            ];
                        }

                        // Si contiene Signature pero es inválida, reportar error estricto
                        $domCheck = new DOMDocument();
                        if (@$domCheck->loadXML($existingXml)) {
                            $xp = new DOMXPath($domCheck);
                            $xp->registerNamespace('ds', SiatXmlSigner::XMLDSIG_NS);
                            if ($xp->query('//ds:Signature')->length > 0) {
                                throw new SiatFiscalException(
                                    "El archivo XML existente en '{$locked->xml_path}' contiene una firma digital inválida: " . $details['error']
                                );
                            }
                        }

                        // Si existe archivo pero aún no estaba firmado (transición de desarrollo 4C -> 4D), firmar
                        return $this->signExistingAndPersist($locked, $existingXml, $disk, $certOverride);
                    }

                    return [
                        'xml_path'                => $locked->xml_path,
                        'already_existed'         => true,
                        'xml_content'             => $existingXml,
                        'is_signed'               => false,
                        'certificate_fingerprint' => null,
                    ];
                }

                throw new SiatFiscalException(
                    "Inconsistencia fiscal: La factura indica tener XML generado en '{$locked->xml_path}', pero el archivo no existe en el almacenamiento."
                );
            }

            // Construir XML en memoria desde snapshot
            $xmlContent = $this->build($locked);

            // Validar contra XSD oficial pre-firma
            $xsdPath = $this->xmlValidator->getXsdPathForModality($modality);
            $this->xmlValidator->validate($xmlContent, $xsdPath);

            $isSigned = false;
            $certFingerprint = null;

            if ($modality === 1) {
                $certData = $certOverride;
                if ($certData === null) {
                    $setting = Setting::first();
                    if (! $setting) {
                        throw new SiatFiscalException('No se encontró configuración fiscal del tenant para obtener el certificado digital.');
                    }
                    $certData = $this->certService->loadFromSetting($setting, Carbon::parse($locked->issued_at));
                }

                $certFingerprint = $certData['fingerprint'] ?? null;

                // Firmar documento XML
                $signedXml = $this->xmlSigner->sign($xmlContent, $certData['pkey'], $certData['cert']);

                // Validación criptográfica local de la firma
                $this->sigValidator->verify($signedXml, $certData['cert'], Carbon::parse($locked->issued_at));

                // Validación XSD oficial post-firma
                $this->xmlValidator->validate($signedXml, $xsdPath);

                $xmlContent = $signedXml;
                $isSigned   = true;
            }

            // Generar ruta de almacenamiento
            $effectiveTenant = $tenantId ?? (function_exists('tenant') && tenant('id') ? (string) tenant('id') : 'default');
            $year            = Carbon::parse($locked->issued_at)->format('Y');
            $month           = Carbon::parse($locked->issued_at)->format('m');
            $relativePath    = "tenant/{$effectiveTenant}/siat/invoices/{$year}/{$month}/{$locked->id}.xml";

            // Escritura en archivo
            $written = $disk->put($relativePath, $xmlContent);
            if (! $written || ! $disk->exists($relativePath)) {
                throw new SiatFiscalException("Error al escribir el archivo XML en el almacenamiento del tenant.");
            }

            // Persistir xml_path en BD
            try {
                $locked->xml_path = $relativePath;
                $locked->save();
            } catch (Throwable $e) {
                // Limpieza de archivo si la persistencia en base de datos falla
                $disk->delete($relativePath);
                throw $e;
            }

            return [
                'xml_path'                => $relativePath,
                'already_existed'         => false,
                'xml_content'             => $xmlContent,
                'is_signed'               => $isSigned,
                'certificate_fingerprint' => $certFingerprint,
            ];
        });
    }

    /**
     * Firma un XML existente sin firma de Modalidad 1 y actualiza el archivo persistido.
     *
     * @throws SiatFiscalException
     */
    public function signExistingAndPersist(
        ElectronicInvoice $invoice,
        string $unsignedXml,
        $disk,
        ?array $certOverride = null
    ): array {
        $certData = $certOverride;
        if ($certData === null) {
            $setting = Setting::first();
            if (! $setting) {
                throw new SiatFiscalException('No se encontró configuración fiscal del tenant para obtener el certificado digital.');
            }
            $certData = $this->certService->loadFromSetting($setting, Carbon::parse($invoice->issued_at));
        }

        $signedXml = $this->xmlSigner->sign($unsignedXml, $certData['pkey'], $certData['cert']);
        $this->sigValidator->verify($signedXml, $certData['cert'], Carbon::parse($invoice->issued_at));

        $xsdPath = $this->xmlValidator->getXsdPathForModality(1);
        $this->xmlValidator->validate($signedXml, $xsdPath);

        $disk->put($invoice->xml_path, $signedXml);

        return [
            'xml_path'                => $invoice->xml_path,
            'already_existed'         => false,
            'xml_content'             => $signedXml,
            'is_signed'               => true,
            'certificate_fingerprint' => $certData['fingerprint'] ?? null,
        ];
    }

    /**
     * Firma digitalmente una factura de Modalidad 1.
     *
     * @throws SiatFiscalException
     */
    public function signInvoice(
        ElectronicInvoice $invoice,
        ?array $certOverride = null
    ): array {
        if ((int) $invoice->siat_modality !== 1) {
            throw new SiatFiscalException('La Modalidad 2 (Computarizada en Línea) no utiliza firma digital.');
        }

        $disk = Storage::disk(config('filesystems.default', 'local'));

        if (empty($invoice->xml_path) || ! $disk->exists($invoice->xml_path)) {
            return $this->buildAndPersist($invoice, null, $certOverride);
        }

        $xml = (string) $disk->get($invoice->xml_path);
        $details = $this->sigValidator->validateDetails($xml);

        if ($details['is_valid']) {
            return [
                'xml_path'                => $invoice->xml_path,
                'already_existed'         => true,
                'already_signed'          => true,
                'xml_content'             => $xml,
                'is_signed'               => true,
                'certificate_fingerprint' => $details['certificate_fingerprint'],
            ];
        }

        return $this->signExistingAndPersist($invoice, $xml, $disk, $certOverride);
    }

    /**
     * Valida que la factura cumpla con todos los requisitos previos antes de construir el XML.
     *
     * @throws SiatFiscalException
     */
    private function validatePrerequisites(ElectronicInvoice $invoice): void
    {
        $status = $invoice->status instanceof ElectronicInvoiceStatus
            ? $invoice->status
            : ElectronicInvoiceStatus::tryFrom((string) $invoice->status);

        if (! in_array($status, [ElectronicInvoiceStatus::DRAFT, ElectronicInvoiceStatus::PENDING], true)) {
            throw new SiatFiscalException(
                "El estado actual de la factura ('{$status?->value}') no permite la generación del XML fiscal."
            );
        }

        if (empty($invoice->invoice_number) || $invoice->invoice_number <= 0) {
            throw new SiatFiscalException("La factura no tiene asignado un número de factura correlativo válido.");
        }

        if (empty($invoice->cuf)) {
            throw new SiatFiscalException("La factura no cuenta con CUF generado. Debe ejecutarse primero la etapa de generación de CUF.");
        }

        if (empty($invoice->issued_at)) {
            throw new SiatFiscalException("La factura no cuenta con fecha de emisión ('issued_at').");
        }

        if (empty($invoice->cufd_snapshot)) {
            throw new SiatFiscalException("La factura no cuenta con el snapshot del CUFD ('cufd_snapshot').");
        }

        if (empty($invoice->control_code)) {
            throw new SiatFiscalException("La factura no cuenta con el código de control del CUFD ('control_code').");
        }

        if (empty($invoice->issuer_nit)) {
            throw new SiatFiscalException("El NIT del emisor es obligatorio para la construcción del XML.");
        }

        if (empty($invoice->issuer_business_name)) {
            throw new SiatFiscalException("La razón social del emisor es obligatoria para la construcción del XML.");
        }

        if (empty($invoice->issuer_municipality)) {
            throw new SiatFiscalException("El municipio del emisor es obligatorio para la construcción del XML.");
        }

        if (empty($invoice->issuer_address)) {
            throw new SiatFiscalException("La dirección fiscal del emisor es obligatoria para la construcción del XML.");
        }

        if (empty($invoice->buyer_document_type) || (int) $invoice->buyer_document_type <= 0) {
            throw new SiatFiscalException("El tipo de documento del comprador es obligatorio.");
        }

        if ($invoice->buyer_document_number === null || trim((string) $invoice->buyer_document_number) === '') {
            throw new SiatFiscalException("El número de documento del comprador es obligatorio.");
        }

        if (empty($invoice->buyer_customer_code)) {
            throw new SiatFiscalException("El código de cliente del comprador es obligatorio.");
        }

        if (empty($invoice->payment_method_code) || (int) $invoice->payment_method_code <= 0) {
            throw new SiatFiscalException("El código de método de pago es obligatorio.");
        }

        if ($invoice->total === null || $invoice->total === '') {
            throw new SiatFiscalException("El monto total de la factura es obligatorio.");
        }

        if ($invoice->total_subject_to_vat === null || $invoice->total_subject_to_vat === '') {
            throw new SiatFiscalException("El monto sujeto a IVA es obligatorio.");
        }

        if (empty($invoice->legend)) {
            throw new SiatFiscalException("La leyenda fiscal oficial es obligatoria.");
        }
    }

    /**
     * Construye el nodo <cabecera> respetando el orden secuencial EXACTO del XSD oficial.
     */
    private function buildCabecera(DOMDocument $dom, DOMElement $cabecera, ElectronicInvoice $invoice): void
    {
        // 1. nitEmisor
        $this->appendElement($dom, $cabecera, 'nitEmisor', (string) $invoice->issuer_nit);

        // 2. razonSocialEmisor
        $this->appendElement($dom, $cabecera, 'razonSocialEmisor', (string) $invoice->issuer_business_name);

        // 3. municipio
        $this->appendElement($dom, $cabecera, 'municipio', (string) $invoice->issuer_municipality);

        // 4. telefono (nillable)
        $this->appendNillableElement($dom, $cabecera, 'telefono', $invoice->issuer_phone);

        // 5. numeroFactura
        $this->appendElement($dom, $cabecera, 'numeroFactura', (string) $invoice->invoice_number);

        // 6. cuf
        $this->appendElement($dom, $cabecera, 'cuf', (string) $invoice->cuf);

        // 7. cufd
        $this->appendElement($dom, $cabecera, 'cufd', (string) $invoice->cufd_snapshot);

        // 8. codigoSucursal (0 es valor válido)
        $this->appendElement($dom, $cabecera, 'codigoSucursal', (string) ((int) $invoice->branch_code));

        // 9. direccion
        $this->appendElement($dom, $cabecera, 'direccion', (string) $invoice->issuer_address);

        // 10. codigoPuntoVenta (nillable, pero 0 es punto de venta 0)
        $posCode = $invoice->point_of_sale_code !== null ? (string) ((int) $invoice->point_of_sale_code) : null;
        $this->appendNillableElement($dom, $cabecera, 'codigoPuntoVenta', $posCode);

        // 11. fechaEmision (formato oficial Y-m-d\TH:i:s.v con milisegundos idénticos a los del CUF)
        $fechaEmision = Carbon::parse($invoice->issued_at)->format('Y-m-d\TH:i:s.v');
        $this->appendElement($dom, $cabecera, 'fechaEmision', $fechaEmision);

        // 12. nombreRazonSocial (nillable en XSD)
        $this->appendNillableElement($dom, $cabecera, 'nombreRazonSocial', $invoice->buyer_name);

        // 13. codigoTipoDocumentoIdentidad
        $this->appendElement($dom, $cabecera, 'codigoTipoDocumentoIdentidad', (string) ((int) $invoice->buyer_document_type));

        // 14. numeroDocumento ('0' para consumidor final sin documento)
        $this->appendElement($dom, $cabecera, 'numeroDocumento', (string) $invoice->buyer_document_number);

        // 15. complemento (nillable)
        $this->appendNillableElement($dom, $cabecera, 'complemento', $invoice->buyer_document_complement);

        // 16. codigoCliente
        $this->appendElement($dom, $cabecera, 'codigoCliente', (string) $invoice->buyer_customer_code);

        // 17. codigoMetodoPago
        $this->appendElement($dom, $cabecera, 'codigoMetodoPago', (string) ((int) $invoice->payment_method_code));

        // 18. numeroTarjeta (nillable)
        $this->appendNillableElement($dom, $cabecera, 'numeroTarjeta', $invoice->card_number);

        // 19. montoTotal (2 decimales exactos)
        $this->appendElement($dom, $cabecera, 'montoTotal', $this->formatAmount($invoice->total));

        // 20. montoTotalSujetoIva (2 decimales exactos)
        $this->appendElement($dom, $cabecera, 'montoTotalSujetoIva', $this->formatAmount($invoice->total_subject_to_vat));

        // 21. codigoMoneda
        $this->appendElement($dom, $cabecera, 'codigoMoneda', (string) ((int) ($invoice->currency_code ?: 1)));

        // 22. tipoCambio (2 decimales en XSD)
        $this->appendElement($dom, $cabecera, 'tipoCambio', $this->formatAmount($invoice->exchange_rate ?: 1));

        // 23. montoTotalMoneda (2 decimales exactos)
        $montoMoneda = $invoice->total_in_currency !== null ? $invoice->total_in_currency : $invoice->total;
        $this->appendElement($dom, $cabecera, 'montoTotalMoneda', $this->formatAmount($montoMoneda));

        // 24. montoGiftCard (nillable, 2 decimales si presente)
        $giftCard = ($invoice->gift_card_amount !== null && (float) $invoice->gift_card_amount > 0)
            ? $this->formatAmount($invoice->gift_card_amount)
            : null;
        $this->appendNillableElement($dom, $cabecera, 'montoGiftCard', $giftCard);

        // 25. descuentoAdicional (nillable, 2 decimales si presente)
        $descAdic = ($invoice->additional_discount !== null && (float) $invoice->additional_discount > 0)
            ? $this->formatAmount($invoice->additional_discount)
            : null;
        $this->appendNillableElement($dom, $cabecera, 'descuentoAdicional', $descAdic);

        // 26. codigoExcepcion (nillable)
        $excCode = $invoice->exception_code !== null ? (string) ((int) $invoice->exception_code) : null;
        $this->appendNillableElement($dom, $cabecera, 'codigoExcepcion', $excCode);

        // 27. cafc (nillable)
        $this->appendNillableElement($dom, $cabecera, 'cafc', $invoice->cafc);

        // 28. leyenda
        $this->appendElement($dom, $cabecera, 'leyenda', (string) $invoice->legend);

        // 29. usuario
        $usuario = ! empty($invoice->issued_by) ? (string) $invoice->issued_by : 'sistema';
        $this->appendElement($dom, $cabecera, 'usuario', $usuario);

        // 30. codigoDocumentoSector
        $sector = $invoice->document_sector_code ? (int) $invoice->document_sector_code : 1;
        $this->appendElement($dom, $cabecera, 'codigoDocumentoSector', (string) $sector);
    }

    /**
     * Construye el nodo <detalle> respetando el orden secuencial EXACTO del XSD oficial.
     */
    private function buildDetalle(DOMDocument $dom, DOMElement $detalle, ElectronicInvoiceDetail $detail): void
    {
        // 1. actividadEconomica
        $this->appendElement($dom, $detalle, 'actividadEconomica', (string) $detail->sin_activity_code);

        // 2. codigoProductoSin
        $this->appendElement($dom, $detalle, 'codigoProductoSin', (string) $detail->sin_product_code);

        // 3. codigoProducto
        $codigoProd = $detail->product_code ?? $detail->internal_product_code ?? $detail->internal_code ?? $detail->sin_product_code ?? '';
        $this->appendElement($dom, $detalle, 'codigoProducto', (string) $codigoProd);

        // 4. descripcion
        $this->appendElement($dom, $detalle, 'descripcion', (string) $detail->description);

        // 5. cantidad (2 decimales en XSD)
        $this->appendElement($dom, $detalle, 'cantidad', $this->formatAmount($detail->quantity));

        // 6. unidadMedida
        $this->appendElement($dom, $detalle, 'unidadMedida', (string) ((int) $detail->sin_unit_code));

        // 7. precioUnitario (2 decimales en XSD)
        $this->appendElement($dom, $detalle, 'precioUnitario', $this->formatAmount($detail->unit_price));

        // 8. montoDescuento (nillable, 2 decimales si presente)
        $descuento = ($detail->discount !== null && (float) $detail->discount > 0)
            ? $this->formatAmount($detail->discount)
            : null;
        $this->appendNillableElement($dom, $detalle, 'montoDescuento', $descuento);

        // 9. subTotal (2 decimales en XSD)
        $this->appendElement($dom, $detalle, 'subTotal', $this->formatAmount($detail->subtotal));

        // 10. numeroSerie (nillable)
        $this->appendNillableElement($dom, $detalle, 'numeroSerie', $detail->serial_number);

        // 11. numeroImei (nillable)
        $imei = $detail->imei_number ?? $detail->imei ?? null;
        $this->appendNillableElement($dom, $detalle, 'numeroImei', $imei);
    }

    /**
     * Formatea un importe a 2 decimales exactos sin notación científica y sin conversión float.
     */
    private function formatAmount(string|int|float $value): string
    {
        $normalized = trim((string) $value);

        return bcadd($normalized, '0', 2);
    }

    /**
     * Añade un elemento con su contenido textual debidamente escapado por DOMDocument.
     */
    private function appendElement(DOMDocument $dom, DOMElement $parent, string $name, string $value): DOMElement
    {
        $elem = $dom->createElement($name);
        $elem->appendChild($dom->createTextNode($value));
        $parent->appendChild($elem);

        return $elem;
    }

    /**
     * Añade un elemento nillable. Si el valor es null o vacío, emite xsi:nil="true".
     */
    private function appendNillableElement(DOMDocument $dom, DOMElement $parent, string $name, ?string $value): DOMElement
    {
        $elem = $dom->createElement($name);

        if ($value === null || trim($value) === '') {
            $elem->setAttribute('xsi:nil', 'true');
        } else {
            $elem->appendChild($dom->createTextNode($value));
        }

        $parent->appendChild($elem);

        return $elem;
    }
}
