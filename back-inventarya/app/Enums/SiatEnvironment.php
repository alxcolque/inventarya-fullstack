<?php

namespace App\Enums;

enum SiatEnvironment: int
{
    case PRODUCTION = 1;
    case PILOT = 2;

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::PRODUCTION => 'Producción',
            self::PILOT => 'Pruebas / Piloto',
        };
    }
}
