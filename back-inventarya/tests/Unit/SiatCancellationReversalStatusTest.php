<?php

namespace Tests\Unit;

use App\Enums\SiatCancellationReversalStatus;
use Tests\TestCase;

class SiatCancellationReversalStatusTest extends TestCase
{
    public function test_confirmed_907_evaluation(): void
    {
        $status = SiatCancellationReversalStatus::fromCode(907);

        $this->assertNotNull($status);
        $this->assertTrue($status->isConfirmed());
        $this->assertFalse($status->isNotAvailable());
        $this->assertEquals('REVERSIÓN DE ANULACIÓN CONFIRMADA', $status->label());
    }

    public function test_rejected_909_and_906_evaluation(): void
    {
        $status909 = SiatCancellationReversalStatus::fromCode(909);
        $this->assertNotNull($status909);
        $this->assertFalse($status909->isConfirmed());
        $this->assertTrue($status909->isRejected());
        $this->assertEquals('REVERSIÓN RECHAZADA', $status909->label());

        $status906 = SiatCancellationReversalStatus::fromCode(906);
        $this->assertNotNull($status906);
        $this->assertFalse($status906->isConfirmed());
        $this->assertTrue($status906->isRejected());
        $this->assertEquals('REVERSIÓN RECHAZADA', $status906->label());
    }

    public function test_not_available_981_evaluation(): void
    {
        $status = SiatCancellationReversalStatus::fromCode(981);

        $this->assertNotNull($status);
        $this->assertTrue($status->isNotAvailable());
        $this->assertTrue($status->isRejected());
        $this->assertEquals('FACTURA NO DISPONIBLE PARA REVERSIÓN', $status->label());
    }

    public function test_deadline_exceeded_3012_and_934(): void
    {
        $status3012 = SiatCancellationReversalStatus::fromCode(3012);
        $this->assertNotNull($status3012);
        $this->assertTrue($status3012->isDeadlineExceeded());

        $status934 = SiatCancellationReversalStatus::fromCode(934);
        $this->assertNotNull($status934);
        $this->assertTrue($status934->isDeadlineExceeded());
    }

    public function test_system_unauthorized_3011(): void
    {
        $status = SiatCancellationReversalStatus::fromCode(3011);
        $this->assertNotNull($status);
        $this->assertEquals('SISTEMA NO SUPERÓ PRUEBAS DE AUTORIZACIÓN PARA REVERSIÓN', $status->label());
    }

    public function test_not_found_924(): void
    {
        $status = SiatCancellationReversalStatus::fromCode(924);
        $this->assertNotNull($status);
        $this->assertTrue($status->isNotFound());
    }

    public function test_null_or_unknown_returns_null(): void
    {
        $this->assertNull(SiatCancellationReversalStatus::fromCode(null));
        $this->assertNull(SiatCancellationReversalStatus::fromCode(''));
        $this->assertNull(SiatCancellationReversalStatus::fromCode(99999));
    }
}
