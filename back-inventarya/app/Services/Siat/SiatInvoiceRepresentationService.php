<?php

namespace App\Services\Siat;

use App\DTOs\SiatInvoiceRepresentationData;
use App\Enums\ElectronicInvoiceStatus;
use App\Exceptions\SiatFiscalException;
use App\Models\ElectronicInvoice;
use Carbon\Carbon;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use Throwable;

/**
 * Servicio encargado de la generación de la Representación Gráfica oficial
 * de Facturas Compra-Venta (Sector 1) en formatos Rollo Térmico (80mm) y Carta/A4 (Fase 4G).
 *
 * Responsabilidades:
 *  1. Validar elegibilidad de la factura según su estado fiscal.
 *  2. Construir el ViewModel/DTO fiscal inmutable (SiatInvoiceRepresentationData)
 *     a partir exclusivamente de los snapshots persistidos en BD (sin consultar Sale/Customer/Product).
 *  3. Generar el código QR fiscal oficial mediante SiatInvoiceQrService.
 *  4. Renderizar las plantillas Blade oficiales (thermal / a4).
 *  5. Generar PDF local determinista mediante Dompdf con soporte Unicode UTF-8 (DejaVu Sans).
 *  6. Gestionar la persistencia e idempotencia de pdf_path en el disco local del tenant.
 *
 * RESTRICCIÓN: CERO llamadas SOAP / SIN. CERO modificaciones de CUF, correlativos o montos.
 */
class SiatInvoiceRepresentationService
{
    public const FORMAT_THERMAL = 'thermal';
    public const FORMAT_A4      = 'a4';

    public function __construct(
        private readonly SiatInvoiceQrService $qrService,
    ) {}

    /**
     * Construye el DTO inmutable con todos los datos requeridos para la representación gráfica.
     *
     * @param  ElectronicInvoice  $invoice
     * @param  string             $format  'thermal' o 'a4'
     * @return SiatInvoiceRepresentationData
     */
    public function buildRepresentationData(ElectronicInvoice $invoice, string $format = self::FORMAT_THERMAL): SiatInvoiceRepresentationData
    {
        // 1. Emisor
        $branchCode = (int) ($invoice->branch_code ?? 0);
        $branchName = ($branchCode === 0) ? 'CASA MATRIZ' : "SUCURSAL N° {$branchCode}";

        $issuer = [
            'business_name' => (string) ($invoice->issuer_business_name ?? 'INVENTARYA S.R.L.'),
            'nit'           => (string) ($invoice->issuer_nit ?? ''),
            'branch_code'   => $branchCode,
            'branch_name'   => $branchName,
            'address'       => (string) ($invoice->issuer_address ?? ''),
            'municipality'  => (string) ($invoice->issuer_municipality ?? 'La Paz'),
            'phone'         => $invoice->issuer_phone ? (string) $invoice->issuer_phone : null,
        ];

        // 2. Factura e Identidad Fiscal
        $cuf = (string) ($invoice->cuf ?? '');
        $cufWrapped = wordwrap($cuf, 32, "\n", true);

        $issuedAt = $invoice->issued_at instanceof Carbon
            ? $invoice->issued_at
            : Carbon::parse($invoice->issued_at ?? now());

        $modality = (int) ($invoice->siat_modality ?? 1);
        $modalityLabel = ($modality === 1) ? 'ELECTRÓNICA EN LÍNEA' : 'COMPUTARIZADA EN LÍNEA';

        $invoiceData = [
            'invoice_number'        => (int) ($invoice->invoice_number ?? 0),
            'cuf'                   => $cuf,
            'cuf_wrapped'           => $cufWrapped,
            'cufd'                  => (string) ($invoice->cufd_snapshot ?? ''),
            'point_of_sale_code'    => (int) ($invoice->point_of_sale_code ?? 0),
            'issued_at'             => $issuedAt->toIso8601String(),
            'issued_at_formatted'   => $issuedAt->format('d/m/Y H:i'),
            'modality'              => $modality,
            'modality_label'        => $modalityLabel,
            'document_sector_label' => 'FACTURA COMPRA-VENTA',
        ];

        // 3. Comprador / Cliente (desde snapshot)
        $docType = (int) ($invoice->buyer_document_type ?? 1);
        $docTypeLabel = match ($docType) {
            1       => 'CI',
            2       => 'CEX',
            3       => 'PAS',
            4       => 'OD',
            5       => 'NIT',
            default => 'DOCUMENTO',
        };

        $buyerName = trim((string) ($invoice->buyer_name ?? ''));
        if (empty($buyerName)) {
            $buyerName = 'CONSUMIDOR FINAL';
        }

        $docNumber = trim((string) ($invoice->buyer_document_number ?? ''));
        if (empty($docNumber) || $docNumber === '0') {
            $docNumber = '0';
        }

        $docComplement = !empty($invoice->buyer_document_complement)
            ? trim((string) $invoice->buyer_document_complement)
            : null;

        $docFull = $docComplement ? "{$docNumber}-{$docComplement}" : $docNumber;

        $buyer = [
            'name'                => $buyerName,
            'document_number'     => $docNumber,
            'document_type'       => $docType,
            'document_type_label' => $docTypeLabel,
            'document_complement' => $docComplement,
            'document_full'       => $docFull,
        ];

        // 4. Detalle de Ítems (desde ElectronicInvoiceDetail snapshots)
        $invoice->loadMissing('details');
        $items = [];
        foreach ($invoice->details as $d) {
            $items[] = [
                'product_code' => (string) ($d->product_code ?? 'P-00'),
                'description'  => (string) ($d->description ?? $d->product_name ?? 'Item'),
                'quantity'     => number_format((float) ($d->quantity ?? 1), 2, '.', ''),
                'unit_price'   => number_format((float) ($d->unit_price ?? $d->price ?? 0), 2, '.', ''),
                'discount'     => number_format((float) ($d->discount ?? 0), 2, '.', ''),
                'subtotal'     => number_format((float) ($d->subtotal ?? 0), 2, '.', ''),
            ];
        }

        // 5. Totales y Moneda
        $currencyCode = (int) ($invoice->currency_code ?? 1);
        $currencySymbol = ($currencyCode === 1) ? 'Bs' : 'USD';
        $currencyName = ($currencyCode === 1) ? 'BOLIVIANOS' : 'DÓLARES';

        $totalVal = (float) ($invoice->total ?? 0);
        $totalFormatted = number_format($totalVal, 2, '.', '');
        $totalLiteral = SiatNumberToWords::toLiteral($totalFormatted, $currencyName);

        $totals = [
            'subtotal'             => number_format((float) ($invoice->subtotal ?? $totalVal), 2, '.', ''),
            'discount'             => number_format((float) ($invoice->discount ?? 0), 2, '.', ''),
            'additional_discount'  => number_format((float) ($invoice->additional_discount ?? 0), 2, '.', ''),
            'gift_card_amount'     => number_format((float) ($invoice->gift_card_amount ?? 0), 2, '.', ''),
            'total'                => $totalFormatted,
            'total_subject_to_vat' => number_format((float) ($invoice->total_subject_to_vat ?? $totalVal), 2, '.', ''),
            'total_literal'        => $totalLiteral,
            'currency_code'        => $currencyCode,
            'currency_symbol'      => $currencySymbol,
        ];

        // 6. Leyendas Obligatorias del SIN (RND 102100000011)
        $legends = [
            'title'           => 'FACTURA',
            'subtitle'        => 'Con Derecho a Crédito Fiscal',
            'system_legend'   => 'Este documento es la Representación Gráfica de un Documento Fiscal Digital emitido en una modalidad de facturación en línea',
            'state_legend'    => 'Esta factura contribuye al desarrollo del país, el uso ilícito será sancionado penalmente de acuerdo a Ley',
            'activity_legend' => (string) ($invoice->legend ?? ''),
        ];

        // 7. Estado Fiscal y Marcas de Agua
        $statusValue = $invoice->status instanceof ElectronicInvoiceStatus
            ? $invoice->status->value
            : (string) ($invoice->status ?? 'draft');

        $isAccepted = ($statusValue === ElectronicInvoiceStatus::ACCEPTED->value);
        $isValidForTaxCredit = $isAccepted && ($statusValue !== ElectronicInvoiceStatus::CANCELLED->value);

        $watermarkText = match ($statusValue) {
            ElectronicInvoiceStatus::ACCEPTED->value   => null,
            ElectronicInvoiceStatus::CANCELLED->value  => 'FACTURA ANULADA',
            ElectronicInvoiceStatus::PROCESSING->value => 'DOCUMENTO FISCAL EN PROCESAMIENTO / NO CONFIRMADO',
            ElectronicInvoiceStatus::REJECTED->value   => 'DOCUMENTO RECHAZADO / NO VÁLIDO PARA CRÉDITO FISCAL',
            default                                    => 'BORRADOR / NO VÁLIDO PARA CRÉDITO FISCAL',
        };

        $fiscalStatus = [
            'status'                  => $statusValue,
            'is_accepted'             => $isAccepted,
            'is_valid_for_tax_credit' => $isValidForTaxCredit,
            'watermark_text'          => $watermarkText,
        ];

        // 8. Código QR Fiscal Oficial
        $qrFormat = ($format === self::FORMAT_A4)
            ? SiatInvoiceQrService::FORMAT_PAGINA
            : SiatInvoiceQrService::FORMAT_ROLLO;

        $qrUrl       = $this->qrService->buildUrlFromInvoice($invoice, $qrFormat);
        $qrSvgRaw    = $this->qrService->generateSvg($qrUrl, ($format === self::FORMAT_A4) ? 130 : 120);
        $qrSvgBase64 = 'data:image/svg+xml;base64,' . base64_encode($qrSvgRaw);

        $qr = [
            'url'        => $qrUrl,
            'svg_base64' => $qrSvgBase64,
            'svg_raw'    => $qrSvgRaw,
        ];

        // 9. Branding
        $branding = [
            'logo_data_uri'   => null,
            'app_attribution' => 'Generado con Inventarya',
        ];

        return new SiatInvoiceRepresentationData(
            issuer: $issuer,
            invoice: $invoiceData,
            buyer: $buyer,
            items: $items,
            totals: $totals,
            legends: $legends,
            fiscalStatus: $fiscalStatus,
            qr: $qr,
            branding: $branding
        );
    }

    /**
     * Renderiza el contenido HTML de la factura utilizando Blade.
     *
     * @param  ElectronicInvoice  $invoice
     * @param  string             $format  'thermal' o 'a4'
     * @return string  HTML renderizado
     */
    public function renderHtml(ElectronicInvoice $invoice, string $format = self::FORMAT_THERMAL): string
    {
        $data = $this->buildRepresentationData($invoice, $format);

        $viewName = ($format === self::FORMAT_A4) ? 'siat.invoices.a4' : 'siat.invoices.thermal';

        return view($viewName, $data->toArray())->render();
    }

    /**
     * Genera o retorna el archivo PDF oficial de la factura electrónica.
     *
     * @param  ElectronicInvoice  $invoice
     * @param  string             $format           'thermal' o 'a4'
     * @param  bool               $forceRegenerate  Forzar regeneración aunque ya exista pdf_path
     * @return array{
     *     path: string,
     *     content: string,
     *     from_cache: bool
     * }
     *
     * @throws SiatFiscalException
     */
    public function generatePdf(
        ElectronicInvoice $invoice,
        string $format = self::FORMAT_THERMAL,
        bool $forceRegenerate = false
    ): array {
        // 1. Idempotencia y versionado:
        // Si la factura está CANCELLED, el PDF debe llevar el sello FACTURA ANULADA y guardarse con sufijo _cancelled.pdf.
        // Si la anulación fue revertida (reinstated), el PDF vuelve a ser válido y se guarda como _reinstated.pdf.
        // Nunca debe retornarse silenciosamente un PDF cacheado anterior de un estado incompatible.
        $isCancelled = ($invoice->status === ElectronicInvoiceStatus::CANCELLED);
        $isReinstated = (!$isCancelled && $invoice->isCancellationReversed());

        $expectedSuffix = match (true) {
            $isCancelled  => "_{$format}_cancelled.pdf",
            $isReinstated => "_{$format}_reinstated.pdf",
            default       => "_{$format}.pdf",
        };

        if (!$forceRegenerate && !empty($invoice->pdf_path) && str_ends_with($invoice->pdf_path, $expectedSuffix)) {
            if (Storage::disk('local')->exists($invoice->pdf_path)) {
                $existingContent = Storage::disk('local')->get($invoice->pdf_path);

                return [
                    'path'       => $invoice->pdf_path,
                    'content'    => $existingContent,
                    'from_cache' => true,
                ];
            }

            // Inconsistencia de almacenamiento: pdf_path registrado en BD pero archivo inexistente en disco
            throw new SiatFiscalException(
                "Inconsistencia de almacenamiento: El archivo PDF registrado para la factura ID '{$invoice->id}' " .
                "no existe en la ruta persistida '{$invoice->pdf_path}'."
            );
        }

        // 2. Renderizar HTML
        $html = $this->renderHtml($invoice, $format);

        // 3. Configurar Dompdf
        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false); // Por seguridad, cero llamadas a URLs externas
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');

        if ($format === self::FORMAT_THERMAL) {
            // Ancho 80mm en puntos (80 / 25.4 * 72 = 226.77 pt); alto continuo/página
            $dompdf->setPaper([0, 0, 226.77, 841.89]);
        } else {
            $dompdf->setPaper('letter', 'portrait');
        }

        $dompdf->render();
        $pdfContent = $dompdf->output();

        if (empty($pdfContent) || !str_starts_with($pdfContent, '%PDF-')) {
            throw new SiatFiscalException("Fallo en la generación binaria del archivo PDF para la factura ID '{$invoice->id}'.");
        }

        // 4. Determinar ruta de almacenamiento
        $tenantId = tenancy()->initialized ? tenant()->id : 'central';
        $issuedAt = $invoice->issued_at instanceof Carbon ? $invoice->issued_at : Carbon::parse($invoice->issued_at ?? now());
        $yearMonth = $issuedAt->format('Y/m');

        $storageSuffix = match (true) {
            $isCancelled  => "_{$format}_cancelled.pdf",
            $isReinstated => "_{$format}_reinstated.pdf",
            default       => "_{$format}.pdf",
        };

        $storagePath = "tenant/{$tenantId}/siat/invoices/{$yearMonth}/{$invoice->id}{$storageSuffix}";

        // 5. Persistir archivo en disco
        Storage::disk('local')->put($storagePath, $pdfContent);

        // 6. Actualizar registro en BD con rollback seguro si falla
        try {
            $invoice->update(['pdf_path' => $storagePath]);
        } catch (Throwable $e) {
            Storage::disk('local')->delete($storagePath);
            Log::error("SIAT: Fallo al actualizar pdf_path en BD para factura {$invoice->id}. Archivo limpiado.", [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }

        return [
            'path'       => $storagePath,
            'content'    => $pdfContent,
            'from_cache' => false,
        ];
    }
}
