<?php

namespace Tests\Unit;

use App\Services\Siat\SiatNumberToWords;
use PHPUnit\Framework\TestCase;

class SiatNumberToWordsTest extends TestCase
{
    public function test_converts_zero_and_simple_amounts(): void
    {
        $this->assertSame('Son: CERO 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(0));
        $this->assertSame('Son: CERO 50/100 BOLIVIANOS', SiatNumberToWords::toLiteral('0.50'));
        $this->assertSame('Son: UN 00/100 BOLIVIANO', SiatNumberToWords::toLiteral(1));
        $this->assertSame('Son: DOS 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(2));
        $this->assertSame('Son: QUINCE 25/100 BOLIVIANOS', SiatNumberToWords::toLiteral('15.25'));
        $this->assertSame('Son: VEINTIUN 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(21));
        $this->assertSame('Son: VEINTICINCO 99/100 BOLIVIANOS', SiatNumberToWords::toLiteral('25.99'));
    }

    public function test_converts_hundreds_and_thousands(): void
    {
        $this->assertSame('Son: CIEN 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(100));
        $this->assertSame('Son: CIENTO CINCUENTA 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(150));
        $this->assertSame('Son: DOSCIENTOS TREINTA Y CUATRO 50/100 BOLIVIANOS', SiatNumberToWords::toLiteral('234.50'));
        $this->assertSame('Son: QUINIENTOS 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(500));
        $this->assertSame('Son: SETECIENTOS OCHENTA Y NUEVE 10/100 BOLIVIANOS', SiatNumberToWords::toLiteral('789.10'));
        $this->assertSame('Son: UN MIL 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(1000));
        $this->assertSame('Son: UN MIL QUINIENTOS 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(1500));
        $this->assertSame('Son: DOS MIL TRESCIENTOS CUARENTA Y CINCO 67/100 BOLIVIANOS', SiatNumberToWords::toLiteral('2345.67'));
    }

    public function test_converts_millions(): void
    {
        $this->assertSame('Son: UN MILLON 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(1000000));
        $this->assertSame('Son: DOS MILLONES QUINIENTOS MIL 00/100 BOLIVIANOS', SiatNumberToWords::toLiteral(2500000));
    }

    public function test_supports_alternative_currency(): void
    {
        $this->assertSame('Son: CIEN 00/100 DOLARES', SiatNumberToWords::toLiteral(100, 'DOLARES'));
    }
}
