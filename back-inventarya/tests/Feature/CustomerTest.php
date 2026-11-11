<?php

namespace Tests\Feature;

use App\Http\Controllers\CustomerController;
use App\Models\Customer;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CustomerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.customer_testing' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => ''],
            'database.default' => 'customer_testing',
        ]);
        DB::purge('customer_testing');

        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('address')->nullable();
            $table->smallInteger('document_type')->nullable();
            $table->string('document_number', 50)->nullable();
            $table->string('document_complement', 20)->nullable();
            $table->timestamps();
            $table->unique(
                ['document_type', 'document_number', 'document_complement'],
                'customers_document_unique'
            );
        });

        Route::apiResource('/testing/customers', CustomerController::class);
    }

    public function test_can_create_customer_with_siat_document_fields(): void
    {
        $response = $this->postJson('/testing/customers', [
            'name' => 'Empresa Los Andes S.R.L.',
            'document_type' => 5,
            'document_number' => '1020304050',
            'phone' => '71234567',
            'email' => 'contacto@andes.com',
            'address' => 'Av. Principal #100',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('customers', [
            'name' => 'Empresa Los Andes S.R.L.',
            'document_type' => 5,
            'document_number' => '1020304050',
        ]);

        $customer = Customer::first();
        $this->assertSame('1020304050', $customer->cinit);
    }

    public function test_legacy_cinit_payload_populates_document_number(): void
    {
        $response = $this->postJson('/testing/customers', [
            'name' => 'Carlos Mendoza',
            'cinit' => '8899001',
            'document_type' => 1,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('customers', [
            'name' => 'Carlos Mendoza',
            'document_number' => '8899001',
        ]);
    }

    public function test_can_update_customer_without_self_unique_collision(): void
    {
        $customer = Customer::create([
            'name' => 'Original Name',
            'document_type' => 1,
            'document_number' => '5544332',
            'document_complement' => '1B',
        ]);

        $response = $this->putJson("/testing/customers/{$customer->id}", [
            'name' => 'Updated Name',
            'document_type' => 1,
            'document_number' => '5544332',
            'document_complement' => '1B',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('customers', [
            'id' => $customer->id,
            'name' => 'Updated Name',
            'document_number' => '5544332',
            'document_complement' => '1B',
        ]);
    }

    public function test_duplicate_document_type_number_and_complement_is_rejected(): void
    {
        Customer::create([
            'name' => 'Cliente A',
            'document_type' => 1,
            'document_number' => '998877',
            'document_complement' => '1A',
        ]);

        $response = $this->postJson('/testing/customers', [
            'name' => 'Cliente B',
            'document_type' => 1,
            'document_number' => '998877',
            'document_complement' => '1A',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['document_number']);
    }

    public function test_same_document_number_with_different_complement_is_allowed(): void
    {
        Customer::create([
            'name' => 'Cliente A',
            'document_type' => 1,
            'document_number' => '998877',
            'document_complement' => '1A',
        ]);

        $response = $this->postJson('/testing/customers', [
            'name' => 'Cliente B (diferente complemento)',
            'document_type' => 1,
            'document_number' => '998877',
            'document_complement' => '1B',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseCount('customers', 2);
    }
}
