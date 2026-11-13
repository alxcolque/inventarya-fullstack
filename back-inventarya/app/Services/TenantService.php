<?php

namespace App\Services;

use App\Events\Central\PaymentReceivedEvent;
use App\Events\Central\TenantApprovedEvent;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Notifications\Tenant\PaymentStatusNotification;
use App\Services\Notifications\NotificationRecipientResolver;
use App\Support\DomainNormalizer;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class TenantService
{
    public function __construct(private readonly DomainRegistrationService $domainRegistration) {}

    /**
     * Create a new tenant with associated domain, subscription, and initial payment (if paid).
     *
     * @throws \Exception
     */
    public function createTenant(array $payload): Tenant
    {
        Log::info('Starting onboarding process for new tenant', [
            'tenant_slug' => $payload['tenant']['slug'] ?? null,
            'domain_count' => count($payload['domains'] ?? []),
            'plan_id' => $payload['subscription']['plan_id'] ?? null,
        ]);

        $tenantPayload = $payload['tenant'];
        $domainsPayload = $payload['domains'] ?? [];
        $subscriptionPayload = $payload['subscription'];
        $ownerPayload = $payload['owner'];

        // Generate unique slug in backend if not provided or empty
        if (empty($tenantPayload['slug'])) {
            $tenantPayload['slug'] = \App\Services\SlugService::generate($tenantPayload['name'], 'tenants', 'slug');
        }

        // 1. Get Plan and check if it's Free or Paid
        $plan = Plan::findOrFail($subscriptionPayload['plan_id']);
        $isFree = ((float) $plan->price === 0.0);

        // 2. Set statuses based on Free/Paid rules
        $tenantStatus = $isFree ? 'active' : 'trial';
        $subscriptionStatus = $isFree ? 'active' : 'pending';

        // 3. Prepare tenant metadata (including encrypted owner credentials for deferred setup)
        $metadata = $tenantPayload['data'] ?? [];
        $metadata['owner_password_encrypted'] = Crypt::encryptString($ownerPayload['password']);

        // 4. Create Tenant and associated records inside a central transaction
        $tenant = DB::transaction(function () use ($tenantPayload, $tenantStatus, $plan, $ownerPayload, $metadata, $domainsPayload, $subscriptionPayload, $subscriptionStatus, $isFree, $payload) {
            $tenant = Tenant::create([
                'id' => $tenantPayload['slug'],
                'name' => $tenantPayload['name'],
                'slug' => $tenantPayload['slug'],
                'status' => $tenantStatus,
                'database' => $tenantPayload['database'], // map database to database column
                'owner_name' => $tenantPayload['owner_name'] ?? $ownerPayload['name'],
                'owner_email' => $tenantPayload['owner_email'] ?? $ownerPayload['email'],
                'owner_phone' => $tenantPayload['owner_phone'] ?? null,
                'logo' => $tenantPayload['logo'] ?? null,
                'business_type_id' => $tenantPayload['business_type_id'] ?? null,
                'data' => $metadata,
                'plan_id' => $plan->id,
            ]);

            // 5. The backend owns the canonical primary domain. Frontend data
            // may add domains, but cannot replace or downgrade this identity.
            $canonicalDomain = $this->domainRegistration->canonicalDomainFor($tenant->slug);
            $this->domainRegistration->create($tenant, [
                'domain' => $canonicalDomain,
                'type' => 'subdomain',
                'is_primary' => true,
            ]);

            foreach ($domainsPayload as $domainData) {
                $requestedDomain = DomainNormalizer::normalize($domainData['domain']);
                if ($requestedDomain === $canonicalDomain) {
                    continue;
                }

                $this->domainRegistration->create($tenant, [
                    'domain' => $requestedDomain,
                    'type' => $domainData['type'],
                    'is_primary' => false,
                ]);
            }

            // 6. Create Subscription
            $isTrial = ! $isFree && ($plan->trial_days > 0);
            $subscriptionStatus = $isFree ? 'active' : ($isTrial ? 'trialing' : 'pending');
            $trialEndsAt = $isTrial ? now()->addDays($plan->trial_days) : null;
            $startsAt = ($isFree || $isTrial) ? now() : null;
            $endsAt = $isTrial ? $trialEndsAt : null;

            $price = $subscriptionPayload['billing_cycle'] === 'yearly' ? $plan->yearly_price : $plan->price;
            $subscription = $tenant->subscriptions()->create([
                'plan_id' => $plan->id,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'trial_ends_at' => $trialEndsAt,
                'status' => $subscriptionStatus,
                'billing_cycle' => $subscriptionPayload['billing_cycle'] ?? 'monthly',
                'price' => $price,
            ]);

            // Set current subscription ID on tenant
            $tenant->update(['current_subscription_id' => $subscription->id]);

            // 7. Create Payment (if paid plan)
            if (! $isFree) {
                $tenant->payments()->create([
                    'subscription_id' => $subscription->id,
                    'plan_id' => $plan->id,
                    'amount' => $price,
                    'currency' => $payload['payment']['currency'] ?? 'BOB',
                    'billing_cycle' => $subscriptionPayload['billing_cycle'] ?? 'monthly',
                    'method' => $payload['payment']['method'] ?? 'qr',
                    'status' => 'pending',
                ]);
            }

            return $tenant;
        });

        // 8. Provision database immediately outside the active central transaction
        try {
            Log::info('Provisioning database immediately (sync) for tenant', ['tenant' => $tenant->id]);
            $provisionService = app(\App\Services\TenantProvisionService::class);
            $provisionService->provision($tenant, $ownerPayload['password']);
        } catch (\Exception $e) {
            Log::error("Failed to provision tenant database for '{$tenant->id}', rolling back central records", [
                'exception' => $e,
            ]);

            // Revert/Delete central records since provisioning failed
            DB::transaction(function () use ($tenant) {
                $tenant->domains()->get()->each->delete();
                $tenant->subscriptions()->delete();
                $tenant->payments()->delete();
                $tenant->delete();
            });

            throw $e;
        }

        return $tenant;
    }

    /**
     * A tenant that already stores product attributes cannot switch to a
     * different business type: the stored keys would no longer match the
     * contract. Assigning a type to a tenant without one is always allowed.
     *
     * @throws ValidationException
     */
    public function assertBusinessTypeChangeAllowed(Tenant $tenant, int $newBusinessTypeId): void
    {
        $current = $tenant->business_type_id;

        if ($current === null || (int) $current === $newBusinessTypeId) {
            return;
        }

        try {
            $hasAttributes = $this->tenantHasProductAttributes($tenant);
        } catch (\Throwable $exception) {
            Log::warning('No se pudo verificar los atributos de productos del tenant.', [
                'tenant_id' => $tenant->id,
                'exception' => $exception->getMessage(),
            ]);
            $hasAttributes = true;
        }

        if ($hasAttributes) {
            throw ValidationException::withMessages([
                'business_type_id' => 'El tenant ya tiene productos con atributos propios de su tipo de negocio actual. No es posible cambiarlo sin una migración de datos.',
            ]);
        }
    }

    protected function tenantHasProductAttributes(Tenant $tenant): bool
    {
        return (bool) $tenant->run(
            fn () => Product::query()->where('attributes', '!=', '{}')->exists()
        );
    }

    /**
     * Confirm a pending payment and activate the associated tenant, domains, and subscription.
     */
    public function confirmTenantPayment(int $paymentId, ?string $receipt = null, ?array $meta = null): Payment
    {
        $tenant = null;
        $wasConfirmed = false;
        $wasActivated = false;

        // 1. Perform central updates in database transaction
        $payment = DB::transaction(function () use ($paymentId, $receipt, $meta, &$tenant, &$wasConfirmed, &$wasActivated) {
            $payment = Payment::with(['tenant', 'subscription', 'plan'])->findOrFail($paymentId);

            if ($payment->status === 'paid') {
                return $payment;
            }

            // Update Payment status to paid
            $payment->update([
                'status' => 'paid',
                'paid_at' => now(),
                'receipt' => $receipt ?? $payment->receipt,
                'meta' => array_merge($payment->meta ?? [], $meta ?? []),
            ]);
            $wasConfirmed = true;

            $tenant = $payment->tenant;
            $wasActivated = $tenant->status !== 'active';
            $subscription = $payment->subscription;

            // Activate Subscription
            $duration = $subscription->billing_cycle === 'yearly' ? now()->addYear() : now()->addMonth();
            $subscription->update([
                'status' => 'active',
                'starts_at' => now(),
                'ends_at' => $duration,
            ]);

            // Activate Tenant and INVENTARYA-managed domains. Custom domains
            // stay pending until an ownership verifier explicitly approves them.
            $tenant->update(['status' => 'active']);
            $tenant->domains()
                ->where('type', 'subdomain')
                ->get()
                ->each(fn ($domain) => $domain->update([
                    'status' => 'active',
                    'verified_at' => $domain->verified_at ?? now(),
                ]));

            return $payment;
        });

        if ($wasConfirmed) {
            if ($wasActivated) {
                try {
                    $this->dispatchTenantApproved($tenant);
                } catch (\Throwable $exception) {
                    Log::error('El tenant se activó, pero no se pudo encolar el correo de aprobación.', [
                        'tenant_id' => $tenant->id,
                        'exception' => $exception->getMessage(),
                    ]);
                }
            }

            try {
                event(new PaymentReceivedEvent([
                    'tenant_name' => $payment->tenant?->name ?? 'Tenant',
                    'amount' => (float) $payment->amount,
                    'currency' => $payment->currency,
                    'plan_name' => $payment->plan?->name ?? 'Plan',
                    'payment_id' => $payment->id,
                ]));
            } catch (\Throwable $exception) {
                Log::error('El pago se confirmó, pero no se pudo notificar al equipo central.', [
                    'payment_id' => $payment->id,
                    'exception' => $exception->getMessage(),
                ]);
            }

            $this->notifyTenantOwnersOfPayment($payment, true);
        }

        return $payment;
    }

    /**
     * Dispatch the owner approval email after a Central activation has persisted.
     */
    public function dispatchTenantApproved(Tenant $tenant): void
    {
        $tenant->loadMissing('domains');
        $domain = $tenant->domains->firstWhere('is_primary', true)?->domain
            ?? $tenant->domains->firstWhere('type', 'subdomain')?->domain
            ?? $this->domainRegistration->canonicalDomainFor((string) $tenant->slug);

        $frontendUrl = config('invitations.tenant_frontend_url');
        if (is_string($frontendUrl) && trim($frontendUrl) !== '') {
            $baseUrl = str_replace('{tenant}', (string) $tenant->slug, $frontendUrl);
        } else {
            $isLocal = str_contains($domain, 'localhost') || str_starts_with($domain, '127.0.0.1');
            $port = $isLocal ? ':'.config('invitations.local_frontend_port') : '';
            $baseUrl = ($isLocal ? 'http://' : 'https://').$domain.$port;
        }

        event(new TenantApprovedEvent([
            'tenant_id' => (string) $tenant->getKey(),
            'owner_name' => trim((string) $tenant->owner_name) ?: 'Cliente',
            'owner_email' => $tenant->owner_email,
            'business_name' => $tenant->name,
            'domain' => $domain,
            'login_url' => rtrim($baseUrl, '/').'/login',
        ]));
    }

    public function notifyTenantOwnersOfPayment(Payment $payment, bool $confirmed): void
    {
        $payment->loadMissing(['tenant', 'plan']);
        $tenant = $payment->tenant;

        if (! $tenant) {
            return;
        }

        try {
            $tenant->run(function () use ($payment, $confirmed) {
                $owners = app(NotificationRecipientResolver::class)->tenantOwners();
                $payload = [
                    'title' => $confirmed ? 'Pago confirmado' : 'Pago rechazado',
                    'message' => $confirmed
                        ? 'Recibimos correctamente el pago de tu suscripción.'
                        : 'No pudimos procesar tu pago. Revisa el método de pago o intenta nuevamente.',
                    'type' => $confirmed ? 'payment_confirmed' : 'payment_rejected',
                    'severity' => $confirmed ? 'success' : 'critical',
                    'payment_id' => $payment->id,
                    'resource' => 'payment',
                    'resource_id' => (string) $payment->id,
                    'action_url' => '/settings',
                ];

                foreach ($owners as $owner) {
                    $notification = new PaymentStatusNotification($payload);
                    $owner->notify($notification);

                    app(PushNotificationService::class)->sendToUser(
                        $owner,
                        $payload['title'],
                        $payload['message'],
                        [
                            ...$payload,
                            'notification_id' => (string) $notification->id,
                            'route' => '/settings',
                        ],
                        'important',
                    );
                }
            });
        } catch (\Throwable $exception) {
            Log::error('No se pudo notificar el estado de un pago al tenant.', [
                'payment_id' => $payment->id,
                'tenant_id' => $tenant->id,
                'status' => $confirmed ? 'confirmed' : 'rejected',
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    public function notifyTenantOwnersOfRefund(Payment $payment, string $reason): void
    {
        $payment->loadMissing(['tenant', 'plan']);
        $tenant = $payment->tenant;

        if (! $tenant) {
            return;
        }

        try {
            $tenant->run(function () use ($payment, $reason) {
                $owners = app(NotificationRecipientResolver::class)->tenantOwners();
                $payload = [
                    'title' => 'Pago reembolsado',
                    'message' => "Se ha procesado un reembolso para el pago #{$payment->id}. Motivo: {$reason}",
                    'type' => 'payment_refunded',
                    'severity' => 'warning',
                    'payment_id' => $payment->id,
                    'resource' => 'payment',
                    'resource_id' => (string) $payment->id,
                    'action_url' => '/settings',
                ];

                foreach ($owners as $owner) {
                    $notification = new PaymentStatusNotification($payload);
                    $owner->notify($notification);

                    app(PushNotificationService::class)->sendToUser(
                        $owner,
                        $payload['title'],
                        $payload['message'],
                        [
                            ...$payload,
                            'notification_id' => (string) $notification->id,
                            'route' => '/settings',
                        ],
                        'important',
                    );
                }
            });
        } catch (\Throwable $exception) {
            Log::error('No se pudo notificar el reembolso del pago al tenant.', [
                'payment_id' => $payment->id,
                'tenant_id' => $tenant->id,
                'exception' => $exception->getMessage(),
            ]);
        }
    }
}
