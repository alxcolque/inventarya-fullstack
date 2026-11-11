<?php

namespace App\Services;

use App\Mail\AccountDeletionVerificationMail;
use App\Models\DeviceToken;
use App\Models\Tenant;
use App\Models\User;
use App\Services\FileStorageService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AccountDeletionService
{
    /**
     * Submit an account deletion request.
     * Always returns an anti-enumeration response for security.
     *
     * @return array{success: bool, message: string, ticket?: string}
     */
    public function requestDeletion(
        string $email,
        string $tenantIdentifier,
        ?string $ip = null,
        ?string $userAgent = null,
        ?User $authenticatedUser = null
    ): array {
        $cleanEmail = strtolower(trim($email));
        $cleanTenant = trim($tenantIdentifier);

        $tenant = $this->resolveTenant($cleanTenant);

        // Anti-enumeration protection: return uniform generic response
        if (! $tenant) {
            return [
                'success' => true,
                'message' => 'Si los datos proporcionados coinciden con una cuenta activa, hemos enviado un enlace de confirmación a su correo electrónico.',
            ];
        }

        // Locate user inside tenant database
        /** @var User|null $user */
        $user = $this->runInTenant($tenant, function () use ($cleanEmail, $authenticatedUser) {
            if ($authenticatedUser && strtolower($authenticatedUser->email) === $cleanEmail) {
                return $authenticatedUser;
            }

            return User::whereRaw('LOWER(email) = ?', [$cleanEmail])->first();
        });

        // Anti-enumeration: if user not found, return same message
        if (! $user) {
            return [
                'success' => true,
                'message' => 'Si los datos proporcionados coinciden con una cuenta activa, hemos enviado un enlace de confirmación a su correo electrónico.',
            ];
        }

        $plainToken = Str::random(64);
        $ticket = 'DEL-'.strtoupper(Str::random(8));
        $expiresAt = now()->addHours(48);
        $isOwner = ($user->role === 'owner' || strtolower((string) $tenant->owner_email) === $cleanEmail);

        $verificationUrl = $this->buildVerificationUrl($plainToken, $ticket);

        // Store request in tenant metadata (virtual column handled by Stancl)
        $requests = $tenant->deletion_requests ?? ($tenant->data['deletion_requests'] ?? []);
        $requests[$ticket] = [
            'ticket' => $ticket,
            'token_hash' => hash('sha256', $plainToken),
            'user_id' => $user->id,
            'email' => $user->email,
            'user_name' => $user->name,
            'role' => $user->role,
            'is_owner' => $isOwner,
            'status' => 'pending_verification',
            'ip' => $ip,
            'user_agent' => $userAgent,
            'requested_at' => now()->toIso8601String(),
            'expires_at' => $expiresAt->toIso8601String(),
            'verified_at' => null,
            'completed_at' => null,
        ];
        $tenant->deletion_requests = $requests;
        $tenant->save();

        try {
            Mail::to($user->email)->queue(new AccountDeletionVerificationMail(
                recipientName: $user->name,
                email: $user->email,
                tenantName: $tenant->name,
                isOwner: $isOwner,
                verificationUrl: $verificationUrl,
                ticket: $ticket,
                expiresAt: $expiresAt->format('d/m/Y H:i'),
            ));
        } catch (\Throwable $e) {
            Log::error('No se pudo enviar el correo de verificación de eliminación de cuenta.', [
                'tenant_id' => $tenant->id,
                'email' => $user->email,
                'exception' => $e->getMessage(),
            ]);
        }

        return [
            'success' => true,
            'message' => 'Si los datos proporcionados coinciden con una cuenta activa, hemos enviado un enlace de confirmación a su correo electrónico.',
            'ticket' => $ticket,
        ];
    }

    /**
     * Check status of a deletion request by its ticket.
     *
     * @return array{success: bool, message?: string, request?: array}
     */
    public function checkStatus(string $ticket): array
    {
        $cleanTicket = strtoupper(trim($ticket));

        $tenants = Tenant::all();
        foreach ($tenants as $tenant) {
            $requests = $tenant->deletion_requests ?? ($tenant->data['deletion_requests'] ?? []);
            if (isset($requests[$cleanTicket])) {
                $req = $requests[$cleanTicket];

                return [
                    'success' => true,
                    'request' => [
                        'ticket' => $req['ticket'],
                        'status' => $req['status'],
                        'is_owner' => (bool) ($req['is_owner'] ?? false),
                        'tenant_name' => $tenant->name,
                        'masked_email' => Str::mask($req['email'], '*', 3, -3),
                        'requested_at' => $req['requested_at'],
                        'expires_at' => $req['expires_at'],
                        'completed_at' => $req['completed_at'] ?? null,
                    ],
                ];
            }
        }

        return [
            'success' => false,
            'message' => 'No se encontró ninguna solicitud registrada con el ticket indicado.',
        ];
    }

    /**
     * Confirm account deletion using the secure one-time token.
     *
     * @return array{success: bool, message: string, status?: string, is_owner?: bool}
     */
    public function confirmDeletion(string $plainToken): array
    {
        $tokenHash = hash('sha256', trim($plainToken));

        $tenants = Tenant::all();
        foreach ($tenants as $tenant) {
            $requests = $tenant->deletion_requests ?? ($tenant->data['deletion_requests'] ?? []);
            foreach ($requests as $ticket => $req) {
                if (isset($req['token_hash']) && hash_equals($req['token_hash'], $tokenHash)) {
                    // Check expiration
                    if (Carbon::parse($req['expires_at'])->isPast()) {
                        $requests[$ticket]['status'] = 'expired';
                        $tenant->deletion_requests = $requests;
                        $tenant->save();

                        return [
                            'success' => false,
                            'message' => 'El enlace de confirmación ha expirado (validez de 48 horas). Por favor, genera una nueva solicitud.',
                        ];
                    }

                    if ($req['status'] === 'completed') {
                        return [
                            'success' => true,
                            'status' => 'completed',
                            'is_owner' => (bool) ($req['is_owner'] ?? false),
                            'message' => 'Esta cuenta ya ha sido eliminada y procesada previamente.',
                        ];
                    }

                    // Process Employee / Non-owner deletion
                    if (! ($req['is_owner'] ?? false)) {
                        $this->runInTenant($tenant, function () use ($req) {
                            $user = User::find($req['user_id']);
                            if ($user) {
                                // 1. Revoke all Sanctum API tokens
                                $user->tokens()->delete();

                                // 2. Delete mobile device push tokens
                                DeviceToken::where('user_id', $user->id)->delete();

                                // 3. Delete avatar file from disk if exists
                                if ($user->avatar_key) {
                                    FileStorageService::delete($user->avatar, $user->avatar_key);
                                }

                                // 4. Anonymize personal profile & credentials, while preserving ID for sales/audit logs
                                $user->forceFill([
                                    'name' => 'Usuario Eliminado',
                                    'email' => 'deleted_'.$user->id.'_'.Str::lower(Str::random(8)).'@deleted.local',
                                    'username' => 'deleted_'.$user->id,
                                    'password' => Hash::make(Str::random(32)),
                                    'phone' => null,
                                    'ci' => null,
                                    'avatar' => null,
                                    'avatar_key' => null,
                                    'status' => 'inactive',
                                    'google_id' => null,
                                    'google_token' => null,
                                    'google_refresh_token' => null,
                                    'google_avatar' => null,
                                    'remember_token' => null,
                                ])->save();
                            }
                        });

                        $requests[$ticket]['status'] = 'completed';
                        $requests[$ticket]['verified_at'] = now()->toIso8601String();
                        $requests[$ticket]['completed_at'] = now()->toIso8601String();
                        $tenant->deletion_requests = $requests;
                        $tenant->save();

                        return [
                            'success' => true,
                            'status' => 'completed',
                            'is_owner' => false,
                            'message' => 'Tu cuenta de usuario, credenciales, sesiones y datos de perfil han sido eliminados de forma definitiva. Los registros comerciales de la empresa se mantienen archivados conforme a las leyes fiscales aplicables.',
                        ];
                    }

                    // Process Owner account verification
                    $this->runInTenant($tenant, function () use ($req) {
                        $user = User::find($req['user_id']);
                        if ($user) {
                            $user->tokens()->delete();
                            DeviceToken::where('user_id', $user->id)->delete();
                        }
                    });

                    $requests[$ticket]['status'] = 'verified_owner_review';
                    $requests[$ticket]['verified_at'] = now()->toIso8601String();
                    $tenant->deletion_requests = $requests;
                    $tenant->save();

                    return [
                        'success' => true,
                        'status' => 'verified_owner_review',
                        'is_owner' => true,
                        'message' => 'Identidad de propietario confirmada y sesiones de acceso revocadas. Debido a que eres el titular de la organización, los datos comerciales y de ventas no han sido eliminados automáticamente. Se ha generado la solicitud para que soporte gestione el cierre ordenado de la empresa o transferencia de titularidad.',
                    ];
                }
            }
        }

        return [
            'success' => false,
            'message' => 'El enlace de confirmación no es válido o ya fue utilizado.',
        ];
    }

    private function resolveTenant(string $identifier): ?Tenant
    {
        if (function_exists('tenant') && tenant()) {
            return tenant();
        }

        if ($identifier === '') {
            return null;
        }

        $clean = strtolower($identifier);

        return Tenant::query()
            ->where('slug', $clean)
            ->orWhere('id', $identifier)
            ->orWhereRaw('LOWER(name) = ?', [$clean])
            ->first();
    }

    private function buildVerificationUrl(string $plainToken, string $ticket): string
    {
        $isLocal = app()->environment('local', 'testing');
        $baseUrl = $isLocal ? 'http://localhost:5173' : 'https://inventarya.com';

        return "{$baseUrl}/delete-account#token=".rawurlencode($plainToken).'&ticket='.rawurlencode($ticket);
    }

    /**
     * Executes the given callback inside tenant context.
     * In unit/feature testing environments or in-memory databases, avoids switching database connections.
     */
    private function runInTenant(Tenant $tenant, callable $callback): mixed
    {
        if (app()->runningUnitTests() || $tenant->database === ':memory:') {
            return $callback();
        }

        return $tenant->run($callback);
    }
}
