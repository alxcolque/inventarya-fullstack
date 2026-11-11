<?php

namespace Tests\Unit;

use App\Enums\SiatCancellationStatus;
use Tests\TestCase;

class SiatCancellationStatusTest extends TestCase
{
    public function test_confirmed_905_evaluation(): void
    {
        $status = SiatCancellationStatus::fromCode(905);

        $this->assertNotNull($status);
        $this->assertTrue($status->isConfirmed());
        $this->assertFalse($status->isRejected());
        $this->assertEquals('ANULACIÓN CONFIRMADA', $status->label());
    }

    public function test_rejected_906_evaluation(): void
    {
        $status = SiatCancellationStatus::fromCode(906);

        $this->assertNotNull($status);
        $this->assertFalse($status->isConfirmed());
        $this->assertTrue($status->isRejected());
        $this->assertEquals('ANULACIÓN RECHAZADA', $status->label());
    }

    public function test_invalid_reason_925(): void
    {
        $status = SiatCancellationStatus::fromCode(925);

        $this->assertNotNull($status);
        $this->assertTrue($status->isInvalidReason());
        $this->assertFalse($status->isConfirmed());
        $this->assertEquals('MOTIVO DE ANULACIÓN INVÁLIDO', $status->label());
    }

    public function test_deadline_exceeded_934(): void
    {
        $status = SiatCancellationStatus::fromCode(934);

        $this->assertNotNull($status);
        $this->assertTrue($status->isDeadlineExceeded());
        $this->assertFalse($status->isConfirmed());
        $this->assertEquals('SOLICITUD DE ANULACIÓN FUERA DE PLAZO', $status->label());
    }

    public function test_not_found_924(): void
    {
        $status = SiatCancellationStatus::fromCode(924);

        $this->assertNotNull($status);
        $this->assertTrue($status->isNotFound());
        $this->assertFalse($status->isConfirmed());
    }

    public function test_null_or_empty_code_returns_null(): void
    {
        $this->assertNull(SiatCancellationStatus::fromCode(null));
        $this->assertNull(SiatCancellationStatus::fromCode(''));
        $this->assertNull(SiatCancellationStatus::fromCode(999999));
    }
}
