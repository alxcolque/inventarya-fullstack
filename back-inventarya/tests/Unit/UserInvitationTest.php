<?php

namespace Tests\Unit;

use App\Http\Requests\ActivateAccountRequest;
use App\Http\Requests\UserRequest;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class UserInvitationTest extends TestCase
{
    public function test_only_fresh_unconsumed_invitation_is_usable(): void
    {
        $invitation = new UserInvitation([
            'expires_at' => now()->addHour(),
        ]);

        $this->assertTrue($invitation->isUsable());

        $invitation->accepted_at = now();
        $this->assertFalse($invitation->isUsable());

        $invitation->accepted_at = null;
        $invitation->revoked_at = now();
        $this->assertFalse($invitation->isUsable());

        $invitation->revoked_at = null;
        $invitation->expires_at = now()->subSecond();
        $this->assertFalse($invitation->isUsable());
    }

    public function test_activation_requires_a_confirmed_strong_password(): void
    {
        $request = new ActivateAccountRequest;

        $valid = Validator::make([
            'token' => str_repeat('a', 64),
            'password' => 'secure123',
            'password_confirmation' => 'secure123',
        ], $request->rules());

        $weak = Validator::make([
            'token' => str_repeat('a', 64),
            'password' => 'password',
            'password_confirmation' => 'different',
        ], $request->rules());

        $this->assertFalse($valid->fails());
        $this->assertTrue($weak->fails());
    }

    public function test_employee_creation_has_no_password_and_cannot_invite_an_owner(): void
    {
        $request = UserRequest::create('/users', 'POST');
        $rules = $request->rules();

        $this->assertArrayNotHasKey('password', $rules);
        $this->assertStringContainsString('required', $rules['role']);
        $this->assertStringContainsString('in:admin,staff', $rules['role']);
    }

    public function test_latest_invitation_relation_does_not_aggregate_its_uuid_key(): void
    {
        $sql = strtolower((new User)->latestInvitation()->getQuery()->toSql());

        $this->assertStringNotContainsString('max(', $sql);
        $this->assertStringContainsString('order by', $sql);
        $this->assertStringContainsString('created_at', $sql);
    }
}
