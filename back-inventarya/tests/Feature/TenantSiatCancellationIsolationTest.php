<?php

namespace Tests\Feature;

use App\Enums\ElectronicInvoiceStatus;
use App\Models\ElectronicInvoice;
use App\Models\SiatCancellationReason;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Siat\FakeSiatSoapClient;
use App\Services\Siat\SiatInvoiceCancellationService;
use App\Services\Siat\SiatServiceFactory;
use Illuminate\Support\Str;
use Tests\TestCase;

class TenantSiatCancellationIsolationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (!Tenant::where('id', 'alex')->exists()) {
            $this->markTestSkipped('Tenant alex no existe en base de datos central.');
        }

        tenancy()->initialize('alex');
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }
        parent::tearDown();
    }

    public function test_siat_cancellation_tables_and_columns_exist_in_tenant(): void
    {
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable('siat_cancellation_reasons'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumns('electronic_invoices', [
            'cancellation_reason_code',
            'cancelled_at',
            'cancellation_status_code',
            'cancellation_pending_at',
            'cancellation_reversed_at',
            'cancellation_reversal_status_code',
            'cancellation_reversal_pending_at',
        ]));
    }

    public function test_cancellation_reasons_isolated_to_tenant(): void
    {
        SiatCancellationReason::updateOrCreate(
            ['code' => 99],
            ['description' => 'MOTIVO TEST TENANT ALEX']
        );

        $this->assertDatabaseHas('siat_cancellation_reasons', [
            'code' => 99,
            'description' => 'MOTIVO TEST TENANT ALEX',
        ]);
    }
}
