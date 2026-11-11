<?php
namespace Tests\Feature;

use App\Http\Controllers\CashRegisterController;
use App\Models\{User, Store, Sale, CashRegisterSession};
use App\Services\CashRegisterService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema, Route, Gate};
use Tests\TestCase;

class CashRegisterTest extends TestCase
{
    private User $owner;
    private Store $store;
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.connections.cash_test' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true], 'database.default' => 'cash_test']);
        DB::purge('cash_test');
        Schema::create('users', function(Blueprint $t) { $t->id(); $t->string('name'); $t->string('role'); $t->timestamps(); });
        Schema::create('stores', function(Blueprint $t) { $t->uuid('id')->primary(); $t->string('name'); $t->timestamps(); });
        Schema::create('assignments', function(Blueprint $t) { $t->id(); $t->unsignedBigInteger('user_id'); $t->uuid('store_id'); });
        Schema::create('sales', function(Blueprint $t) { $t->uuid('id')->primary(); $t->uuid('store_id'); $t->unsignedBigInteger('user_id'); $t->decimal('total',15,2); $t->decimal('discount',15,2)->default(0); $t->string('payment_method'); $t->string('status'); $t->timestamps(); });
        (require database_path('migrations/tenant/2026_10_11_000001_create_cash_register_tables.php'))->up();
        Schema::create('sale_payments', function(Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('sale_id');
            $t->uuid('cash_register_session_id')->nullable();
            $t->string('payment_method', 50);
            $t->decimal('amount', 15, 2);
            $t->decimal('amount_received', 15, 2)->nullable();
            $t->decimal('change_amount', 15, 2)->nullable();
            $t->string('reference', 100)->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
        });
        Route::prefix('test/cash')->controller(CashRegisterController::class)->group(function() {
            Route::post('open', 'open'); Route::get('active/{store}', 'active');
            Route::post('{session}/movements', 'movement'); Route::post('{session}/close', 'close');
            Route::get('{session}/summary','summary'); Route::get('history','history');
        });
        $this->owner = User::create(['name'=>'Owner','role'=>'owner']);
        $this->store = Store::create(['name'=>'Central']);
        $this->actingAs($this->owner);
    }
    private function open(string $amount='0', ?Store $store=null): string
    {
        return $this->postJson('/test/cash/open',['store_id'=>($store??$this->store)->id,'opening_amount'=>$amount])
            ->assertCreated()->json('session.id');
    }
    public function test_open_zero_duplicate_and_separate_stores(): void
    {
        $id=$this->open();
        $this->getJson('/test/cash/active/'.$this->store->id)->assertOk()->assertJsonPath('session.id',$id);
        $this->postJson('/test/cash/open',['store_id'=>$this->store->id,'opening_amount'=>1])->assertUnprocessable();
        $this->open('10',Store::create(['name'=>'Another']));
        $this->assertSame(2,CashRegisterSession::count());
    }
    public function test_negative_open_and_movements_are_rejected(): void
    {
        $this->postJson('/test/cash/open',['store_id'=>$this->store->id,'opening_amount'=>-1])->assertUnprocessable();
        $id=$this->open();
        foreach([-1,0,'0.001'] as $amount) $this->postJson('/test/cash/'.$id.'/movements',['type'=>'expense','amount'=>$amount,'reason'=>'Test'])->assertUnprocessable();
        $this->postJson('/test/cash/'.$id.'/movements',['type'=>'other','amount'=>1,'reason'=>'Test'])->assertUnprocessable();
    }
    public function test_summary_and_close_exact_money_and_status(): void
    {
        $id=$this->open('200');
        foreach([['efectivo','500','completado'],['qr','350','completed'],['transferencia','25','completado'],['efectivo','100','cancelado']] as [$method,$amount,$status]) {
            Sale::create(['store_id'=>$this->store->id,'user_id'=>$this->owner->id,'total'=>$amount,'discount'=>10,'payment_method'=>$method,'status'=>$status,'cash_register_session_id'=>$id]);
        }
        foreach([['income',50],['expense',20]] as [$type,$amount]) $this->postJson('/test/cash/'.$id.'/movements',compact('type','amount')+['reason'=>'Test','user_id'=>999])->assertCreated()->assertJsonPath('movement.user_id',$this->owner->id);
        $this->getJson('/test/cash/'.$id.'/summary')->assertOk()->assertJsonPath('expected_cash','730.00')->assertJsonPath('sales.total','875.00')->assertJsonPath('sales.cash','500.00');
        $this->postJson('/test/cash/'.$id.'/close',['closing_amount'=>'725','expected_amount'=>0,'closed_by'=>999])->assertOk()->assertJsonPath('session.expected_amount','730.00')->assertJsonPath('session.difference','-5.00')->assertJsonPath('session.closed_by',$this->owner->id);
        $this->postJson('/test/cash/'.$id.'/close',['closing_amount'=>725])->assertUnprocessable();
        $this->postJson('/test/cash/'.$id.'/movements',['type'=>'income','amount'=>1,'reason'=>'Test'])->assertUnprocessable();
        $this->getJson('/test/cash/active/'.$this->store->id)->assertJsonPath('has_open_session',false);
    }
    public function test_surplus_and_exact_closing(): void
    {
        foreach([['10.10','0.10'],['10.00','0.00']] as [$counted,$difference]) {
            $id=$this->open('10');
            $this->postJson('/test/cash/'.$id.'/close',['closing_amount'=>$counted])->assertOk()->assertJsonPath('session.difference',$difference);
        }
    }
    public function test_assigned_staff_only_and_unknown_session(): void
    {
        $staff=User::create(['name'=>'Staff','role'=>'staff']);
        $id=$this->open();
        $this->actingAs($staff);
        $this->getJson('/test/cash/active/'.$this->store->id)->assertForbidden();
        $this->postJson('/test/cash/'.$id.'/close',['closing_amount'=>0])->assertForbidden();
        DB::table('assignments')->insert(['user_id'=>$staff->id,'store_id'=>$this->store->id]);
        $this->getJson('/test/cash/'.$id.'/summary')->assertOk();
        $this->getJson('/test/cash/'.\Illuminate\Support\Str::uuid().'/summary')->assertNotFound();
    }
    public function test_sale_session_resolver_preserves_original_and_rejects_late_sync(): void
    {
        $id=$this->open();
        $service=app(CashRegisterService::class);
        $this->assertSame($id,DB::transaction(fn()=> $service->forSale($this->owner,$this->store->id,$id,true))->id);
        $service->close($this->owner,$id,['closing_amount'=>'0']);
        $this->open();
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        DB::transaction(fn()=> $service->forSale($this->owner,$this->store->id,$id,true));
    }
    public function test_unique_constraint_and_transaction_rollback(): void
    {
        $id=$this->open();
        try { DB::transaction(fn()=> CashRegisterSession::create(['store_id'=>$this->store->id,'user_id'=>$this->owner->id,'opening_amount'=>0,'opened_at'=>now(),'status'=>'open'])); $this->fail('Unique index required'); }
        catch(\Illuminate\Database\QueryException) { $this->assertSame(1,CashRegisterSession::count()); }
        $this->assertSame('open',CashRegisterSession::findOrFail($id)->status);
    }
    public function test_historical_sale_remains_unassigned(): void
    {
        $sale=Sale::create(['store_id'=>$this->store->id,'user_id'=>$this->owner->id,'total'=>10,'payment_method'=>'efectivo','status'=>'completed']);
        $this->open();
        $this->assertNull($sale->fresh()->cash_register_session_id);
    }
}
