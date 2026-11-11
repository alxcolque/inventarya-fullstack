<?php

namespace Tests\Feature;

use App\Enums\ElectronicInvoiceStatus;
use App\Models\ElectronicInvoice;
use App\Models\ElectronicInvoiceDetail;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SiatCufd;
use App\Models\Store;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TenantElectronicInvoicePersistenceTest extends TestCase
{
    private User $user;
    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.invoice_test' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => true,
            ],
            'database.default' => 'invoice_test',
        ]);
        DB::purge('invoice_test');

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->timestamps();
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->boolean('enable_electronic_invoicing')->default(false);
            $table->integer('sin_branch_code')->nullable();
            $table->integer('sin_point_of_sale_code')->nullable();
            $table->timestamps();
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('color', 20)->default('#6366f1');
            $table->timestamps();
        });

        Schema::create('brands', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('slug')->nullable();
            $table->string('sku')->nullable();
            $table->string('barcode')->nullable();
            $table->string('sin_product_code')->nullable();
            $table->string('sin_activity_code')->nullable();
            $table->integer('sin_unit_code')->nullable();
            $table->timestamps();
        });

        Schema::create('sales', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->timestamp('order_date')->nullable();
            $table->bigInteger('customer_id')->default(0);
            $table->foreignUuid('store_id')->nullable()->constrained('stores');
            $table->decimal('total', 15, 2)->default(0.00);
            $table->decimal('discount', 15, 2)->default(0.00);
            $table->string('payment_method', 50)->default('efectivo');
            $table->foreignId('user_id')->constrained('users');
            $table->string('status')->default('completed');
            $table->string('name')->nullable();
            $table->string('phone')->nullable();
            $table->string('observation')->nullable();
            $table->uuid('cash_register_session_id')->nullable();
            $table->timestamps();
        });

        Schema::create('sale_details', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('sale_id')->constrained('sales')->cascadeOnDelete();
            $table->foreignUuid('product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('quantity', 15, 3)->default(0.000);
            $table->decimal('price', 15, 2)->default(0.00);
            $table->decimal('subtotal', 15, 2)->default(0.00);
            $table->timestamps();
        });

        // Run the 3 new migrations directly
        (require database_path('migrations/tenant/2026_10_12_000001_create_siat_cufds_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000002_create_electronic_invoices_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000003_create_electronic_invoice_details_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000009_create_siat_invoice_sequences_table.php'))->up();
        (require database_path('migrations/tenant/2026_10_12_000010_create_siat_payment_mappings_table.php'))->up();

        $this->user = User::create(['name' => 'Vendedor Test']);
        $this->store = Store::create([
            'name' => 'Casa Matriz',
            'enable_electronic_invoicing' => true,
            'sin_branch_code' => 0,
            'sin_point_of_sale_code' => 0,
        ]);
    }

    private function createSale(string $total = '100.00', string $discount = '0.00'): Sale
    {
        return Sale::create([
            'user_id' => $this->user->id,
            'store_id' => $this->store->id,
            'total' => $total,
            'discount' => $discount,
            'status' => 'completed',
        ]);
    }

    public function test_tables_and_uuid_primary_keys_exist(): void
    {
        $this->assertTrue(Schema::hasTable('siat_cufds'));
        $this->assertTrue(Schema::hasTable('electronic_invoices'));
        $this->assertTrue(Schema::hasTable('electronic_invoice_details'));

        $cufd = SiatCufd::create([
            'store_id' => $this->store->id,
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'cufd' => 'CUFD-TEST-KEY-001',
        ]);
        $this->assertMatchesRegularExpression('/^[0-9a-fA-F-]{36}$/', $cufd->id);

        $sale = $this->createSale('150.00');
        $invoice = ElectronicInvoice::create([
            'sale_id' => $sale->id,
            'store_id' => $this->store->id,
            'siat_cufd_id' => $cufd->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA DEMO S.R.L.',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 1,
            'buyer_document_number' => '1234567',
            'buyer_name' => 'Juan Pérez',
            'subtotal' => '150.00',
            'discount' => '0.00',
            'total' => '150.00',
        ]);
        $this->assertMatchesRegularExpression('/^[0-9a-fA-F-]{36}$/', $invoice->id);

        $detail = ElectronicInvoiceDetail::create([
            'electronic_invoice_id' => $invoice->id,
            'description' => 'Servicio de Consultoría',
            'quantity' => '1.000',
            'unit_price' => '150.00',
            'subtotal' => '150.00',
        ]);
        $this->assertMatchesRegularExpression('/^[0-9a-fA-F-]{36}$/', $detail->id);
    }

    public function test_relationships_between_sale_store_invoice_and_cufd(): void
    {
        $sale = $this->createSale('200.00');
        $cufd = SiatCufd::create([
            'store_id' => $this->store->id,
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'cufd' => 'CUFD-RELATIONS-999',
        ]);

        $invoice = ElectronicInvoice::create([
            'sale_id' => $sale->id,
            'store_id' => $this->store->id,
            'siat_cufd_id' => $cufd->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA DEMO S.R.L.',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 5,
            'buyer_document_number' => '987654321',
            'buyer_name' => 'CLIENTE CORPORATIVO S.A.',
            'subtotal' => '200.00',
            'total' => '200.00',
        ]);

        $detail1 = ElectronicInvoiceDetail::create([
            'electronic_invoice_id' => $invoice->id,
            'description' => 'Item 1',
            'quantity' => '2.000',
            'unit_price' => '50.00',
            'subtotal' => '100.00',
        ]);
        $detail2 = ElectronicInvoiceDetail::create([
            'electronic_invoice_id' => $invoice->id,
            'description' => 'Item 2',
            'quantity' => '1.000',
            'unit_price' => '100.00',
            'subtotal' => '100.00',
        ]);

        // Sale -> ElectronicInvoice (HasOne)
        $this->assertTrue($sale->electronicInvoice()->exists());
        $this->assertSame($invoice->id, $sale->electronicInvoice->id);

        // ElectronicInvoice -> Sale (BelongsTo)
        $this->assertSame($sale->id, $invoice->sale->id);

        // Store -> ElectronicInvoices (HasMany)
        $this->assertCount(1, $this->store->electronicInvoices);

        // Store -> SiatCufds (HasMany)
        $this->assertCount(1, $this->store->siatCufds);

        // ElectronicInvoice -> SiatCufd (BelongsTo)
        $this->assertSame($cufd->id, $invoice->siatCufd->id);

        // SiatCufd -> ElectronicInvoices (HasMany)
        $this->assertCount(1, $cufd->electronicInvoices);

        // ElectronicInvoice -> Details (HasMany)
        $this->assertCount(2, $invoice->details);
        $this->assertSame($invoice->id, $detail1->electronicInvoice->id);
    }

    public function test_sale_id_is_strictly_unique(): void
    {
        $sale = $this->createSale('100.00');

        ElectronicInvoice::create([
            'sale_id' => $sale->id,
            'store_id' => $this->store->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA DEMO S.R.L.',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 1,
            'buyer_document_number' => '12345',
            'buyer_name' => 'Cliente A',
            'subtotal' => '100.00',
            'total' => '100.00',
        ]);

        $this->expectException(QueryException::class);

        // Segunda factura para la misma venta debe fallar por UNIQUE constraint
        ElectronicInvoice::create([
            'sale_id' => $sale->id,
            'store_id' => $this->store->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA DEMO S.R.L.',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 1,
            'buyer_document_number' => '12345',
            'buyer_name' => 'Cliente Duplicado',
            'subtotal' => '100.00',
            'total' => '100.00',
        ]);
    }

    public function test_multiple_invoices_with_null_cuf_allowed_but_duplicate_cuf_rejected(): void
    {
        $sale1 = $this->createSale('10.00');
        $sale2 = $this->createSale('20.00');

        // Dos facturas en borrador con cuf = null
        $inv1 = ElectronicInvoice::create([
            'sale_id' => $sale1->id,
            'store_id' => $this->store->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 1,
            'buyer_document_number' => '111',
            'buyer_name' => 'Cliente 1',
            'cuf' => null,
            'subtotal' => '10.00',
            'total' => '10.00',
        ]);

        $inv2 = ElectronicInvoice::create([
            'sale_id' => $sale2->id,
            'store_id' => $this->store->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 1,
            'buyer_document_number' => '222',
            'buyer_name' => 'Cliente 2',
            'cuf' => null,
            'subtotal' => '20.00',
            'total' => '20.00',
        ]);

        $this->assertNull($inv1->cuf);
        $this->assertNull($inv2->cuf);

        // Asignar CUF a inv1
        $inv1->update(['cuf' => 'CUF-UNIQUE-ABC-123']);

        $this->expectException(QueryException::class);
        // Intentar asignar el mismo CUF a inv2 debe violar la unicidad
        $inv2->update(['cuf' => 'CUF-UNIQUE-ABC-123']);
    }

    public function test_snapshots_are_preserved_independently_of_source_entities(): void
    {
        $product = Product::create([
            'name' => 'Paracetamol 500mg Original',
            'sin_product_code' => 'SIN-PROD-001',
            'sin_activity_code' => 'ACT-8511',
            'sin_unit_code' => 58,
        ]);

        $sale = $this->createSale('45.00');

        $invoice = ElectronicInvoice::create([
            'sale_id' => $sale->id,
            'store_id' => $this->store->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'FARMACIA CENTRAL',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 1,
            'siat_modality' => 2,
            'buyer_document_type' => 1,
            'buyer_document_number' => '445566',
            'buyer_document_complement' => '1A',
            'buyer_name' => 'Carlos Rodríguez',
            'subtotal' => '45.00',
            'discount' => '5.00',
            'total' => '40.00',
        ]);

        $detail = ElectronicInvoiceDetail::create([
            'electronic_invoice_id' => $invoice->id,
            'product_id' => $product->id,
            'product_code' => 'MED-001',
            'sin_product_code' => $product->sin_product_code,
            'sin_activity_code' => $product->sin_activity_code,
            'sin_unit_code' => $product->sin_unit_code,
            'description' => $product->name,
            'quantity' => '3.000',
            'unit_price' => '15.00',
            'discount' => '5.00',
            'subtotal' => '40.00',
        ]);

        // Modificar el producto original en el catálogo
        $product->update([
            'name' => 'Paracetamol 500mg Caja x20 Renovado',
            'sin_product_code' => 'SIN-PROD-999',
            'sin_unit_code' => 99,
        ]);

        // Modificar la tienda
        $this->store->update(['name' => 'Nueva Razón Social Modificada']);

        // El snapshot del detalle se mantiene inalterado
        $detail->refresh();
        $this->assertSame('Paracetamol 500mg Original', $detail->description);
        $this->assertSame('SIN-PROD-001', $detail->sin_product_code);
        $this->assertSame(58, $detail->sin_unit_code);

        // El snapshot del emisor y comprador se mantiene inalterado
        $invoice->refresh();
        $this->assertSame('FARMACIA CENTRAL', $invoice->issuer_business_name);
        $this->assertSame('Carlos Rodríguez', $invoice->buyer_name);
        $this->assertSame('445566', $invoice->buyer_document_number);
        $this->assertSame('1A', $invoice->buyer_document_complement);
    }

    public function test_deleting_product_sets_product_id_null_without_deleting_invoice_detail(): void
    {
        $product = Product::create([
            'name' => 'Producto Descartable',
        ]);
        $sale = $this->createSale('50.00');
        $invoice = ElectronicInvoice::create([
            'sale_id' => $sale->id,
            'store_id' => $this->store->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 1,
            'buyer_document_number' => '111',
            'buyer_name' => 'Comprador',
            'subtotal' => '50.00',
            'total' => '50.00',
        ]);

        $detail = ElectronicInvoiceDetail::create([
            'electronic_invoice_id' => $invoice->id,
            'product_id' => $product->id,
            'description' => 'Producto Descartable',
            'quantity' => '1.000',
            'unit_price' => '50.00',
            'subtotal' => '50.00',
        ]);

        // Eliminar producto
        $product->delete();

        // El detalle histórico subsiste pero con product_id = null (nullOnDelete)
        $detail->refresh();
        $this->assertNull($detail->product_id);
        $this->assertSame('Producto Descartable', $detail->description);
    }

    public function test_deleting_invoiced_sale_is_restricted_by_foreign_key(): void
    {
        $sale = $this->createSale('120.00');
        ElectronicInvoice::create([
            'sale_id' => $sale->id,
            'store_id' => $this->store->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 1,
            'buyer_document_number' => '111',
            'buyer_name' => 'Comprador',
            'subtotal' => '120.00',
            'total' => '120.00',
        ]);

        // Eliminar la venta debe fallar por ON DELETE RESTRICT
        $this->expectException(QueryException::class);
        $sale->delete();
    }

    public function test_cufd_history_coexistence_and_null_dates(): void
    {
        // Dos CUFDs para la misma sucursal y punto de venta
        $cufd1 = SiatCufd::create([
            'store_id' => $this->store->id,
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'cufd' => 'CUFD-HISTORICO-DIA-1',
            'is_active' => false,
            'valid_from' => null,
            'valid_until' => null,
        ]);

        $cufd2 = SiatCufd::create([
            'store_id' => $this->store->id,
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'cufd' => 'CUFD-ACTIVO-DIA-2',
            'is_active' => true,
            'valid_from' => '2026-10-12 08:00:00',
            'valid_until' => '2026-10-13 08:00:00',
        ]);

        $this->assertSame(0, $cufd1->branch_code);
        $this->assertSame(0, $cufd1->point_of_sale_code);
        $this->assertNull($cufd1->valid_from);
        $this->assertNull($cufd1->valid_until);

        // Coexisten en la base de datos
        $this->assertSame(2, SiatCufd::where('store_id', $this->store->id)->count());
    }

    public function test_status_enum_casting_and_monetary_precision(): void
    {
        $sale = $this->createSale('150.75', '10.25');

        $invoice = ElectronicInvoice::create([
            'sale_id' => $sale->id,
            'store_id' => $this->store->id,
            'issuer_nit' => '1020304050',
            'issuer_business_name' => 'EMPRESA',
            'branch_code' => 0,
            'point_of_sale_code' => 0,
            'siat_environment' => 2,
            'siat_modality' => 1,
            'buyer_document_type' => 1,
            'buyer_document_number' => '111',
            'buyer_name' => 'Comprador',
            'status' => ElectronicInvoiceStatus::DRAFT,
            'subtotal' => '161.00',
            'discount' => '10.25',
            'total' => '150.75',
        ]);

        $this->assertInstanceOf(ElectronicInvoiceStatus::class, $invoice->status);
        $this->assertSame(ElectronicInvoiceStatus::DRAFT, $invoice->status);
        $this->assertSame('Borrador', $invoice->status->label());

        // Verificar precisión monetaria exacta (strings decimales sin perder precisión)
        $this->assertSame('161.00', (string) $invoice->subtotal);
        $this->assertSame('10.25', (string) $invoice->discount);
        $this->assertSame('150.75', (string) $invoice->total);

        // Transición de estado a ACCEPTED
        $invoice->update(['status' => ElectronicInvoiceStatus::ACCEPTED]);
        $invoice->refresh();
        $this->assertSame(ElectronicInvoiceStatus::ACCEPTED, $invoice->status);
        $this->assertSame('Aceptada', $invoice->status->label());
    }
}
