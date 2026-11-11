<?php

namespace App\Services;

use App\Mail\UserInvitationMail;
use App\Models\User;
use App\Models\UserInvitation;
use App\Services\Notifications\NotificationRecipientResolver;
use App\Support\TenantFrontendUrl;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmployeeInvitationService
{
    public function __construct(
        private readonly NotificationRecipientResolver $recipientResolver,
        private readonly NotificationService $notificationService,
    ) {}

    /**
     * Create a disabled employee account and issue its first invitation.
     *
     * @return array{user: User, invitation: UserInvitation, invitation_sent: bool}
     */
    public function createEmployee(array $data, User $inviter): array
    {
        [$user, $invitation, $plainToken] = DB::transaction(function () use ($data, $inviter) {
            $user = User::create([
                ...$data,
                'username' => $this->uniqueUsername($data['username'] ?? null, $data['email']),
                'status' => 'pending_activation',
                'email_verified_at' => null,
            ]);

            [$invitation, $plainToken] = $this->issueToken($user, $inviter);

            return [$user, $invitation, $plainToken];
        });

        return [
            'user' => $user,
            'invitation' => $invitation,
            'invitation_sent' => $this->sendInvitation($user, $inviter, $invitation, $plainToken),
        ];
    }

    /**
     * Revoke every previous invitation and issue a fresh one.
     *
     * @return array{invitation: UserInvitation, invitation_sent: bool}
     */
    public function resend(User $user, User $inviter): array
    {
        if ($user->status !== 'pending_activation') {
            throw ValidationException::withMessages([
                'user' => 'Sólo se pueden reenviar invitaciones a cuentas pendientes de activación.',
            ]);
        }

        [$invitation, $plainToken] = DB::transaction(function () use ($user, $inviter) {
            UserInvitation::query()
                ->where('user_id', $user->id)
                ->whereNull('accepted_at')
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            return $this->issueToken($user, $inviter);
        });

        return [
            'invitation' => $invitation,
            'invitation_sent' => $this->sendInvitation($user, $inviter, $invitation, $plainToken),
        ];
    }

    public function inspect(string $plainToken): UserInvitation
    {
        $invitation = UserInvitation::query()
            ->with('user:id,name,email,status')
            ->where('token_hash', $this->hashToken($plainToken))
            ->first();

        $this->ensureUsable($invitation);

        return $invitation;
    }

    public function activate(string $plainToken, string $password): User
    {
        $user = DB::transaction(function () use ($plainToken, $password) {
            $invitation = UserInvitation::query()
                ->with('user')
                ->where('token_hash', $this->hashToken($plainToken))
                ->lockForUpdate()
                ->first();

            $this->ensureUsable($invitation);

            $user = $invitation->user;
            $user->forceFill([
                'password' => Hash::make($password),
                'status' => 'active',
                'email_verified_at' => now(),
            ])->save();

            $invitation->update(['accepted_at' => now()]);

            UserInvitation::query()
                ->where('user_id', $user->id)
                ->where('id', '!=', $invitation->id)
                ->whereNull('accepted_at')
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            $user->tokens()->delete();

            return $user->fresh();
        });

        $this->notifyAccountActivated($user);

        return $user;
    }

    /** @return array{UserInvitation, string} */
    private function issueToken(User $user, User $inviter): array
    {
        $plainToken = Str::random(64);
        $invitation = UserInvitation::create([
            'user_id' => $user->id,
            'invited_by_id' => $inviter->id,
            'token_hash' => $this->hashToken($plainToken),
            'expires_at' => now()->addHours(max(1, (int) config('invitations.expires_hours'))),
        ]);

        return [$invitation, $plainToken];
    }

    private function sendInvitation(
        User $user,
        User $inviter,
        UserInvitation $invitation,
        string $plainToken,
    ): bool {
        try {
            $mail = (new UserInvitationMail(
                recipientName: $user->name,
                invitedByName: $inviter->name,
                tenantName: tenant('name') ?? 'Inventarya',
                activationUrl: $this->activationUrl($plainToken),
                expiresAt: $invitation->expires_at->format('d/m/Y H:i'),
            ))->afterCommit();

            Mail::to($user->email)->queue($mail);

            return true;
        } catch (\Throwable $exception) {
            Log::error('No se pudo enviar una invitación de usuario.', [
                'tenant_id' => tenant('id'),
                'user_id' => $user->id,
                'exception' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private function notifyAccountActivated(User $user): void
    {
        try {
            $owners = $this->recipientResolver->tenantOwners();

            $this->notificationService->sendToRecipients(
                $owners,
                'Cuenta activada',
                "{$user->name} activó correctamente su cuenta en Inventarya.",
                [
                    'severity' => 'info',
                    'action_url' => '/users',
                    'resource' => 'user',
                    'resource_id' => (string) $user->id,
                ],
                'employee_activated',
            );
        } catch (\Throwable $exception) {
            Log::error('La cuenta fue activada, pero no se pudo notificar a los propietarios.', [
                'tenant_id' => tenant('id'),
                'user_id' => $user->id,
                'channel' => 'database,broadcast,push',
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    private function activationUrl(string $plainToken): string
    {
        return TenantFrontendUrl::to('/activate-account#token='.rawurlencode($plainToken));
    }

    private function uniqueUsername(?string $requestedUsername, string $email): string
    {
        $base = Str::lower(Str::slug($requestedUsername ?: Str::before($email, '@'), ''));
        $base = $base ?: 'usuario';
        $candidate = Str::limit($base, 55, '');
        $suffix = 1;

        while (User::where('username', $candidate)->exists()) {
            $candidate = Str::limit($base, 55, '').$suffix++;
        }

        return $candidate;
    }

    private function hashToken(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    private function ensureUsable(?UserInvitation $invitation): void
    {
        if (! $invitation || ! $invitation->isUsable() || $invitation->user?->status !== 'pending_activation') {
            throw ValidationException::withMessages([
                'token' => 'La invitación no es válida, ya fue utilizada o ha expirado.',
            ]);
        }
    }
}
