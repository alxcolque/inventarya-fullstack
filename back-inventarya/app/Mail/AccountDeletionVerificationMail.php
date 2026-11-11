<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AccountDeletionVerificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $recipientName,
        public readonly string $email,
        public readonly string $tenantName,
        public readonly bool $isOwner,
        public readonly string $verificationUrl,
        public readonly string $ticket,
        public readonly string $expiresAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Confirmación de solicitud de eliminación de cuenta - {$this->tenantName}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.account-deletion-verification',
        );
    }
}
