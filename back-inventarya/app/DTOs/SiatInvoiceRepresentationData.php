<?php

namespace App\DTOs;

/**
 * Data Transfer Object / ViewModel para la representación gráfica fiscal (Fase 4G).
 *
 * Aísla completamente la capa de presentación (Blade / Dompdf) del modelo de datos
 * y relaciones Eloquent. Se construye exclusivamente a partir de los snapshots
 * inmutables persistidos en ElectronicInvoice y ElectronicInvoiceDetail.
 */
class SiatInvoiceRepresentationData
{
    /**
     * @param  array{
     *     business_name: string,
     *     nit: string,
     *     branch_code: int,
     *     branch_name: string,
     *     address: string,
     *     municipality: string,
     *     phone: string|null
     * } $issuer
     *
     * @param  array{
     *     invoice_number: int,
     *     cuf: string,
     *     cuf_wrapped: string,
     *     cufd: string,
     *     point_of_sale_code: int,
     *     issued_at: string,
     *     issued_at_formatted: string,
     *     modality: int,
     *     modality_label: string,
     *     document_sector_label: string
     * } $invoice
     *
     * @param  array{
     *     name: string,
     *     document_number: string,
     *     document_type: int,
     *     document_type_label: string,
     *     document_complement: string|null,
     *     document_full: string
     * } $buyer
     *
     * @param  array<int, array{
     *     product_code: string,
     *     description: string,
     *     quantity: string,
     *     unit_price: string,
     *     discount: string,
     *     subtotal: string
     * }> $items
     *
     * @param  array{
     *     subtotal: string,
     *     discount: string,
     *     additional_discount: string,
     *     gift_card_amount: string,
     *     total: string,
     *     total_subject_to_vat: string,
     *     total_literal: string,
     *     currency_code: int,
     *     currency_symbol: string
     * } $totals
     *
     * @param  array{
     *     title: string,
     *     subtitle: string,
     *     system_legend: string,
     *     state_legend: string,
     *     activity_legend: string
     * } $legends
     *
     * @param  array{
     *     status: string,
     *     is_accepted: bool,
     *     is_valid_for_tax_credit: bool,
     *     watermark_text: string|null
     * } $fiscalStatus
     *
     * @param  array{
     *     url: string,
     *     svg_base64: string,
     *     svg_raw: string
     * } $qr
     *
     * @param  array{
     *     logo_data_uri: string|null,
     *     app_attribution: string
     * } $branding
     */
    public function __construct(
        public readonly array $issuer,
        public readonly array $invoice,
        public readonly array $buyer,
        public readonly array $items,
        public readonly array $totals,
        public readonly array $legends,
        public readonly array $fiscalStatus,
        public readonly array $qr,
        public readonly array $branding,
    ) {}

    /**
     * Retorna una representación en array plano serializable para JSON o Blade.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'issuer'       => $this->issuer,
            'invoice'      => $this->invoice,
            'buyer'        => $this->buyer,
            'items'        => $this->items,
            'totals'       => $this->totals,
            'legends'      => $this->legends,
            'fiscalStatus' => $this->fiscalStatus,
            'qr'           => $this->qr,
            'branding'     => $this->branding,
        ];
    }
}
