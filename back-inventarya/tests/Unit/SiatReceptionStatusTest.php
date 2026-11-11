<?php

namespace Tests\Unit;

use App\Enums\ElectronicInvoiceStatus;
use App\Enums\SiatReceptionStatus;
use PHPUnit\Framework\TestCase;

class SiatReceptionStatusTest extends TestCase
{
    public function test_from_code_resolves_all_standard_codes(): void
    {
        $this->assertSame(SiatReceptionStatus::PENDING, SiatReceptionStatus::fromCode(901));
        $this->assertSame(SiatReceptionStatus::REJECTED, SiatReceptionStatus::fromCode(902));
        $this->assertSame(SiatReceptionStatus::PROCESSED, SiatReceptionStatus::fromCode(903));
        $this->assertSame(SiatReceptionStatus::OBSERVED, SiatReceptionStatus::fromCode(904));
        $this->assertSame(SiatReceptionStatus::VALIDATED, SiatReceptionStatus::fromCode(908));
        $this->assertSame(SiatReceptionStatus::NOT_FOUND, SiatReceptionStatus::fromCode(924));

        // String inputs
        $this->assertSame(SiatReceptionStatus::VALIDATED, SiatReceptionStatus::fromCode('908'));
        $this->assertNull(SiatReceptionStatus::fromCode(null));
        $this->assertNull(SiatReceptionStatus::fromCode(''));
        $this->assertNull(SiatReceptionStatus::fromCode(999999));
    }

    public function test_is_validated_only_true_for_908(): void
    {
        $this->assertTrue(SiatReceptionStatus::VALIDATED->isValidated());
        $this->assertFalse(SiatReceptionStatus::OBSERVED->isValidated());
        $this->assertFalse(SiatReceptionStatus::REJECTED->isValidated());
        $this->assertFalse(SiatReceptionStatus::PENDING->isValidated());
        $this->assertFalse(SiatReceptionStatus::NOT_FOUND->isValidated());
    }

    public function test_is_observed_only_true_for_904(): void
    {
        $this->assertTrue(SiatReceptionStatus::OBSERVED->isObserved());
        $this->assertFalse(SiatReceptionStatus::VALIDATED->isObserved());
        $this->assertFalse(SiatReceptionStatus::REJECTED->isObserved());
    }

    public function test_is_rejected_true_for_rejection_codes(): void
    {
        $this->assertTrue(SiatReceptionStatus::REJECTED->isRejected());
        $this->assertTrue(SiatReceptionStatus::CUIS_INVALID->isRejected());
        $this->assertTrue(SiatReceptionStatus::CUFD_INVALID->isRejected());
        $this->assertTrue(SiatReceptionStatus::INVALID_FILE->isRejected());
        $this->assertTrue(SiatReceptionStatus::INCORRECT_SIGNATURE->isRejected());
        $this->assertTrue(SiatReceptionStatus::INVALID_CERTIFICATE->isRejected());

        $this->assertFalse(SiatReceptionStatus::VALIDATED->isRejected());
        $this->assertFalse(SiatReceptionStatus::OBSERVED->isRejected());
        $this->assertFalse(SiatReceptionStatus::NOT_FOUND->isRejected());
    }

    public function test_resolve_electronic_invoice_status_mapping(): void
    {
        // 908 -> ACCEPTED
        $this->assertSame(
            ElectronicInvoiceStatus::ACCEPTED,
            SiatReceptionStatus::VALIDATED->resolveElectronicInvoiceStatus()
        );

        // 902 -> REJECTED
        $this->assertSame(
            ElectronicInvoiceStatus::REJECTED,
            SiatReceptionStatus::REJECTED->resolveElectronicInvoiceStatus()
        );

        // 904 -> PROCESSING (nunca accepted, nunca rejected ciegamente)
        $this->assertSame(
            ElectronicInvoiceStatus::PROCESSING,
            SiatReceptionStatus::OBSERVED->resolveElectronicInvoiceStatus()
        );

        // 901 / 903 -> PROCESSING
        $this->assertSame(
            ElectronicInvoiceStatus::PROCESSING,
            SiatReceptionStatus::PENDING->resolveElectronicInvoiceStatus()
        );
        $this->assertSame(
            ElectronicInvoiceStatus::PROCESSING,
            SiatReceptionStatus::PROCESSED->resolveElectronicInvoiceStatus()
        );

        // 924 -> PROCESSING (requiere decisión humana, no reenvío ciego)
        $this->assertSame(
            ElectronicInvoiceStatus::PROCESSING,
            SiatReceptionStatus::NOT_FOUND->resolveElectronicInvoiceStatus()
        );
    }
}
