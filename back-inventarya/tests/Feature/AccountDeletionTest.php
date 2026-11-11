<?php

namespace Tests\Feature;

use App\Mail\AccountDeletionVerificationMail;
use App\Models\DeviceToken;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AccountDeletionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AccountDeletionTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.connections.central' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
                'foreign_key_constraints' => false,
            ],
            'database.default' => 'central',
        ]);
        DB::purge('central');

        Schema::create('tenants', function (Blueprint $table) {
            $table->string('id', 36)->primary();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status')->default('active');
            $table->string('database');
            $table->string('owner_name')->nullable();
            $table->string('owner_email')->nullable();
            $table->string('owner_phone')->nullable();
            $table->string('logo')->nullable();
            $table->json('data')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('username', 64)->nullable();
            $table->string('avatar')->nullable();
            $table->string('avatar_key')->nullable();
            $table->string('role')->default('staff');
            $table->string('status')->default('active')->nullable();
            $table->string('phone')->nullable();
            $table->string('ci')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->string('google_id')->nullable();
            $table->string('google_token')->nullable();
            $table->string('google_refresh_token')->nullable();
            $table->string('google_avatar')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('device_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id');
            $table->string('token');
            $table->string('platform')->nullable();
            $table->string('app_version')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
        });

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        $this->tenant = Tenant::create([
            'id' => 'tenant-corp',
            'name' => 'Corporacion Demo',
            'slug' => 'corp-demo',
            'database' => ':memory:',
            'owner_name' => 'Owner Juan',
            'owner_email' => 'owner@corpdemo.com',
            'status' => 'active',
            'data' => [],
        ]);
    }

    public function test_public_request_with_unknown_tenant_returns_anti_enumeration(): void
    {
        Mail::fake();
        $service = new AccountDeletionService();

        $response = $service->requestDeletion('user@example.com', 'unknown-empresa');

        $this->assertTrue($response['success']);
        $this->assertStringContainsString('Si los datos proporcionados coinciden', $response['message']);
        Mail::assertNothingQueued();
    }

    public function test_public_request_with_unknown_user_returns_anti_enumeration(): void
    {
        Mail::fake();
        $service = new AccountDeletionService();

        $response = $service->requestDeletion('nonexistent@corpdemo.com', 'corp-demo');

        $this->assertTrue($response['success']);
        $this->assertStringContainsString('Si los datos proporcionados coinciden', $response['message']);
        Mail::assertNothingQueued();
    }

    public function test_public_request_with_valid_employee_queues_email_and_records_request(): void
    {
        Mail::fake();

        $employee = User::create([
            'name' => 'Carlos Empleado',
            'email' => 'carlos@corpdemo.com',
            'role' => 'staff',
            'status' => 'active',
            'password' => Hash::make('password123'),
        ]);

        $service = new AccountDeletionService();
        $response = $service->requestDeletion('carlos@corpdemo.com', 'corp-demo', '127.0.0.1', 'PHPUnit');

        $this->assertTrue($response['success']);
        $this->assertNotEmpty($response['ticket']);

        Mail::assertQueued(AccountDeletionVerificationMail::class, function ($mail) {
            return $mail->email === 'carlos@corpdemo.com' && ! $mail->isOwner;
        });

        // Check stored request in tenant data
        $this->tenant->refresh();
        $requests = $this->tenant->deletion_requests ?? ($this->tenant->data['deletion_requests'] ?? []);
        $this->assertArrayHasKey($response['ticket'], $requests);
        $this->assertSame('pending_verification', $requests[$response['ticket']]['status']);
    }

    public function test_status_inquiry_returns_correct_details(): void
    {
        $employee = User::create([
            'name' => 'Maria Staff',
            'email' => 'maria@corpdemo.com',
            'role' => 'staff',
            'status' => 'active',
        ]);

        Mail::fake();
        $service = new AccountDeletionService();
        $res = $service->requestDeletion('maria@corpdemo.com', 'corp-demo');
        $ticket = $res['ticket'];

        $status = $service->checkStatus($ticket);

        $this->assertTrue($status['success']);
        $this->assertSame($ticket, $status['request']['ticket']);
        $this->assertSame('pending_verification', $status['request']['status']);
        $this->assertFalse($status['request']['is_owner']);
        $this->assertSame('Corporacion Demo', $status['request']['tenant_name']);
    }

    public function test_confirm_employee_deletion_anonymizes_user_and_revokes_tokens(): void
    {
        Mail::fake();

        $employee = User::create([
            'name' => 'Pedro Vendedor',
            'email' => 'pedro@corpdemo.com',
            'role' => 'staff',
            'status' => 'active',
            'password' => Hash::make('secret123'),
        ]);

        $token = $employee->createToken('test-device')->plainTextToken;
        $deviceToken = DeviceToken::create([
            'user_id' => $employee->id,
            'token' => 'fcm-sample-token-1234',
            'platform' => 'android',
        ]);

        $service = new AccountDeletionService();
        $res = $service->requestDeletion('pedro@corpdemo.com', 'corp-demo');

        // Retrieve the plain token from the queued email
        $plainToken = null;
        Mail::assertQueued(AccountDeletionVerificationMail::class, function ($mail) use (&$plainToken) {
            parse_str(parse_url($mail->verificationUrl, PHP_URL_FRAGMENT) ?? '', $params);
            $plainToken = $params['token'] ?? null;

            return true;
        });

        $this->assertNotNull($plainToken);

        $confirm = $service->confirmDeletion($plainToken);

        $this->assertTrue($confirm['success']);
        $this->assertSame('completed', $confirm['status']);
        $this->assertFalse($confirm['is_owner']);

        // Verify user is anonymized and deactivated
        $employee->refresh();
        $this->assertSame('Usuario Eliminado', $employee->name);
        $this->assertSame('inactive', $employee->status);
        $this->assertStringStartsWith('deleted_'.$employee->id, $employee->email);
        $this->assertCount(0, $employee->tokens);
        $this->assertDatabaseMissing('device_tokens', ['user_id' => $employee->id]);
    }

    public function test_confirm_owner_deletion_marks_verified_and_protects_company_data(): void
    {
        Mail::fake();

        $owner = User::create([
            'name' => 'Owner Juan',
            'email' => 'owner@corpdemo.com',
            'role' => 'owner',
            'status' => 'active',
            'password' => Hash::make('secret123'),
        ]);

        $service = new AccountDeletionService();
        $res = $service->requestDeletion('owner@corpdemo.com', 'corp-demo');

        $plainToken = null;
        Mail::assertQueued(AccountDeletionVerificationMail::class, function ($mail) use (&$plainToken) {
            parse_str(parse_url($mail->verificationUrl, PHP_URL_FRAGMENT) ?? '', $params);
            $plainToken = $params['token'] ?? null;

            return true;
        });

        $confirm = $service->confirmDeletion($plainToken);

        $this->assertTrue($confirm['success']);
        $this->assertSame('verified_owner_review', $confirm['status']);
        $this->assertTrue($confirm['is_owner']);
        $this->assertStringContainsString('titular de la organización', $confirm['message']);

        // Verify company is NOT destroyed automatically
        $this->assertDatabaseHas('tenants', ['id' => 'tenant-corp']);
    }

    public function test_expired_token_is_rejected(): void
    {
        Mail::fake();

        $employee = User::create([
            'name' => 'Ana Tester',
            'email' => 'ana@corpdemo.com',
            'role' => 'staff',
            'status' => 'active',
        ]);

        $service = new AccountDeletionService();
        $res = $service->requestDeletion('ana@corpdemo.com', 'corp-demo');

        // Force expired date on request
        $this->tenant->refresh();
        $requests = $this->tenant->deletion_requests ?? ($this->tenant->data['deletion_requests'] ?? []);
        $ticket = $res['ticket'];
        $requests[$ticket]['expires_at'] = now()->subMinutes(10)->toIso8601String();
        $this->tenant->deletion_requests = $requests;
        $this->tenant->save();

        $plainToken = null;
        Mail::assertQueued(AccountDeletionVerificationMail::class, function ($mail) use (&$plainToken) {
            parse_str(parse_url($mail->verificationUrl, PHP_URL_FRAGMENT) ?? '', $params);
            $plainToken = $params['token'] ?? null;

            return true;
        });

        $confirm = $service->confirmDeletion($plainToken);

        $this->assertFalse($confirm['success']);
        $this->assertStringContainsString('ha expirado', $confirm['message']);
    }
}
