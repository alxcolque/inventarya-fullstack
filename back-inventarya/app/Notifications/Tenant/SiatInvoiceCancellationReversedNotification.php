<?php

namespace App\Notifications\Tenant;

use App\Models\ElectronicInvoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notificación al Comprador sobre la Reversión de Anulación Fiscal de su Factura (RND 102300000034).
 *
 * Comunica que el documento fiscal ha vuelto a estado VÁLIDO ante el SIN.
 */
class SiatInvoiceCancellationReversedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly array $snapshotData
    ) {}

    public static function fromInvoice(ElectronicInvoice $invoice): self
    {
        return new self([
            'invoice_id'     => $invoice->id,
            'invoice_number' => $invoice->invoice_number,
            'cuf'            => $invoice->cuf,
            'buyer_name'     => $invoice->buyer_name ?? 'CONSUMIDOR FINAL',
            'issued_at'      => $invoice->issued_at?->format('d/m/Y H:i') ?? '',
            'total'          => number_format((float) ($invoice->total ?? 0), 2, '.', ''),
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
        $issuedAt      = $this->snapshotData['issued_at'];
        $total         = $this->snapshotData['total'];

        return (new MailMessage)
            ->subject("Restitución de Factura Fiscal N° {$invoiceNumber}")
            ->greeting("Estimado(a) {$buyerName},")
            ->line("Le informamos que la Factura N° {$invoiceNumber} con Código Único de Factura (CUF): {$cuf} ha sido REVERTIDA fiscalmente ante el Servicio de Impuestos Nacionales (SIN).")
            ->line("El documento fiscal ha recuperado su validez legal plena y se encuentra en estado VÁLIDO con derecho a crédito fiscal.")
            ->line("Monto total facturado: Bs. {$total}")
            ->line("Fecha de emisión original: {$issuedAt}")
            ->line("Este mensaje es emitido en cumplimiento de la normativa tributaria vigente de facturación en línea.");
    }

    public function toArray(object $notifiable): array
    {
        return $this->snapshotData;
    }
}
