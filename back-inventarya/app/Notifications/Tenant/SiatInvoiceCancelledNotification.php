<?php

namespace App\Notifications\Tenant;

use App\Models\ElectronicInvoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notificación Oficial al Comprador sobre la Anulación Fiscal de su Factura (RND 102100000011).
 *
 * Emplea exclusivamente los datos persistidos en el snapshot fiscal de ElectronicInvoice
 * y la descripción oficial del catálogo de motivos de anulación.
 */
class SiatInvoiceCancelledNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly array $snapshotData
    ) {}

    public static function fromInvoiceAndReason(ElectronicInvoice $invoice, int $reasonCode, string $reasonDescription): self
    {
        return new self([
            'invoice_id'         => $invoice->id,
            'invoice_number'     => $invoice->invoice_number,
            'cuf'                => $invoice->cuf,
            'buyer_name'         => $invoice->buyer_name ?? 'CONSUMIDOR FINAL',
            'issued_at'          => $invoice->issued_at?->format('d/m/Y H:i') ?? '',
            'total'              => number_format((float) ($invoice->total ?? 0), 2, '.', ''),
            'reason_code'        => $reasonCode,
            'reason_description' => $reasonDescription,
        ]);
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $invoiceNumber = $this->snapshotData['invoice_number'];
        $cuf           = $this->snapshotData['cuf'];
        $buyerName     = $this->snapshotData['buyer_name'];
        $reason        = $this->snapshotData['reason_description'];
        $reasonCode    = $this->snapshotData['reason_code'];
        $issuedAt      = $this->snapshotData['issued_at'];
        $total         = $this->snapshotData['total'];

        return (new MailMessage)
            ->subject("Notificación de Anulación de Factura N° {$invoiceNumber}")
            ->greeting("Estimado(a) {$buyerName},")
            ->line("Le informamos que la Factura N° {$invoiceNumber} emitida a su nombre ha sido fiscalmente ANULADA ante el Servicio de Impuestos Nacionales (SIN).")
            ->line("Código Único de Factura (CUF): {$cuf}")
            ->line("Motivo oficial de anulación: [{$reasonCode}] {$reason}")
            ->line("Monto total facturado: Bs. {$total}")
            ->line("Fecha de emisión original: {$issuedAt}")
            ->line("Este mensaje es emitido en cumplimiento de la normativa tributaria vigente de facturación en línea.");
    }

    public function toArray(object $notifiable): array
    {
        return $this->snapshotData;
    }
}
