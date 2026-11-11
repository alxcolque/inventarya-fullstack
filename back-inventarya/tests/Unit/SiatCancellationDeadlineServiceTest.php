<?php

namespace Tests\Unit;

use App\Services\Siat\SiatCancellationDeadlineService;
use Carbon\Carbon;
use Tests\TestCase;

class SiatCancellationDeadlineServiceTest extends TestCase
{
    private SiatCancellationDeadlineService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new SiatCancellationDeadlineService();
    }

    public function test_october_01_allows_cancellation_until_november_09(): void
    {
        $issuedAt = Carbon::create(2026, 10, 1, 10, 0, 0, 'America/La_Paz');
        $deadline = $this->service->getDeadline($issuedAt);

        $this->assertEquals('2026-11-09 23:59:59', $deadline->format('Y-m-d H:i:s'));

        // Permitido el 9 de noviembre antes de medianoche
        $onLimit = Carbon::create(2026, 11, 9, 23, 59, 59, 'America/La_Paz');
        $this->assertTrue($this->service->isWithinDeadline($issuedAt, $onLimit));

        // Bloqueado el 10 de noviembre
        $pastLimit = Carbon::create(2026, 11, 10, 0, 0, 1, 'America/La_Paz');
        $this->assertFalse($this->service->isWithinDeadline($issuedAt, $pastLimit));
    }

    public function test_october_31_allows_cancellation_until_november_09(): void
    {
        // Factura emitida el último día del mes (31 de octubre)
        $issuedAt = Carbon::create(2026, 10, 31, 23, 0, 0, 'America/La_Paz');
        $deadline = $this->service->getDeadline($issuedAt);

        // El límite sigue siendo exactamente el 9 de noviembre, NO 30 días después
        $this->assertEquals('2026-11-09 23:59:59', $deadline->format('Y-m-d H:i:s'));

        $this->assertTrue($this->service->isWithinDeadline($issuedAt, '2026-11-09 18:00:00'));
        $this->assertFalse($this->service->isWithinDeadline($issuedAt, '2026-11-10 00:00:01'));
    }

    public function test_december_to_january_year_transition(): void
    {
        // Factura emitida en diciembre
        $issuedAt = Carbon::create(2025, 12, 15, 14, 30, 0, 'America/La_Paz');
        $deadline = $this->service->getDeadline($issuedAt);

        $this->assertEquals('2026-01-09 23:59:59', $deadline->format('Y-m-d H:i:s'));

        $this->assertTrue($this->service->isWithinDeadline($issuedAt, '2026-01-09 23:59:59'));
        $this->assertFalse($this->service->isWithinDeadline($issuedAt, '2026-01-10 00:00:00'));
    }

    public function test_january_to_february_transition(): void
    {
        // Factura emitida a fines de enero
        $issuedAt = Carbon::create(2026, 1, 31, 20, 0, 0, 'America/La_Paz');
        $deadline = $this->service->getDeadline($issuedAt);

        $this->assertEquals('2026-02-09 23:59:59', $deadline->format('Y-m-d H:i:s'));

        $this->assertTrue($this->service->isWithinDeadline($issuedAt, '2026-02-09 12:00:00'));
        $this->assertFalse($this->service->isWithinDeadline($issuedAt, '2026-02-10 08:00:00'));
    }

    public function test_leap_year_february_transition(): void
    {
        // Año bisiesto (2024): febrero tiene 29 días
        $issuedAt = Carbon::create(2024, 2, 29, 12, 0, 0, 'America/La_Paz');
        $deadline = $this->service->getDeadline($issuedAt);

        $this->assertEquals('2024-03-09 23:59:59', $deadline->format('Y-m-d H:i:s'));

        $this->assertTrue($this->service->isWithinDeadline($issuedAt, '2024-03-09 23:59:59'));
        $this->assertFalse($this->service->isWithinDeadline($issuedAt, '2024-03-10 00:00:01'));
    }
}
