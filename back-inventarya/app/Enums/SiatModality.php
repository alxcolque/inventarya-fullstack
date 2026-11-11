<?php

namespace App\Enums;

enum SiatModality: int
{
    case ELECTRONIC_ONLINE = 1;
    case COMPUTERIZED_ONLINE = 2;

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::ELECTRONIC_ONLINE => 'Electrónica en Línea',
            self::COMPUTERIZED_ONLINE => 'Computarizada en Línea',
        };
    }
}
