<?php

namespace App\Enums;

enum ElectronicInvoiceStatus: string
{
    case DRAFT = 'draft';
    case PENDING = 'pending';
    case PROCESSING = 'processing';
    case ACCEPTED = 'accepted';
    case REJECTED = 'rejected';
    case CANCELLED = 'cancelled';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::DRAFT => 'Borrador',
            self::PENDING => 'Pendiente',
            self::PROCESSING => 'En procesamiento',
            self::ACCEPTED => 'Aceptada',
            self::REJECTED => 'Rechazada',
            self::CANCELLED => 'Anulada',
        };
    }
}
