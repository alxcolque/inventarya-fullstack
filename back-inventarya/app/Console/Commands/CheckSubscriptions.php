<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Notifications\Tenant\SubscriptionExpiringNotification;
use App\Services\Notifications\NotificationRecipientResolver;
use App\Services\PushNotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CheckSubscriptions extends Command
{
    protected $signature = 'inventarya:check-subscriptions';

    protected $description = 'Verifica suscripciones de inquilinos próximas a vencer y despacha notificaciones a los dueños';

    public function handle(
        NotificationRecipientResolver $resolver,
        PushNotificationService $pushNotificationService,
    ) {
        $today = Carbon::now()->startOfDay();
        $this->info("Iniciando revisión de suscripciones: {$today->toDateString()}");

        // Buscar suscripciones activas con fecha de finalización
        $subscriptions = Subscription::with(['tenant', 'plan'])
            ->whereIn('status', ['active', 'trialing'])
            ->get();

        foreach ($subscriptions as $sub) {
            $tenant = $sub->tenant;
            if (! $tenant) {
                continue;
            }

            $isTrial = $sub->status === 'trialing';
            $targetDate = $isTrial ? $sub->trial_ends_at : $sub->ends_at;

            if (! $targetDate) {
                continue;
            }

            $endsAt = Carbon::parse($targetDate)->startOfDay();
            $daysLeft = (int) $today->diffInDays($endsAt, false);

            // Solo alertar en ventanas críticas: 7 días, 3 días, 1 día o si ya venció (<= 0)
            if (! in_array($daysLeft, [7, 3, 1]) && $daysLeft > 0) {
                continue;
            }

            $planName = $sub->plan?->name ?? 'Plan Inventarya';

            // Notificar dentro del tenant correspondiente
            $tenant->run(function () use ($resolver, $pushNotificationService, $daysLeft, $planName, $sub, $isTrial) {
                $isExpired = $daysLeft <= 0;
                $type = $isTrial
                    ? ($isExpired ? 'trial_expired' : 'trial_expiring')
                    : ($isExpired ? 'subscription_expired' : 'subscription_expiring');
                $threshold = $isExpired ? 'expired' : (string) $daysLeft;

                $alreadyNotified = DB::table('notifications')
                    ->where('data->type', $type)
                    ->whereJsonContains('data->subscription_id', $sub->id)
                    ->whereJsonContains('data->threshold', $threshold)
                    ->exists();

                if ($alreadyNotified) {
                    return;
                }

                $owners = $resolver->tenantOwners();
                if ($owners->isEmpty()) {
                    return;
                }

                $payload = [
                    'title' => $isTrial
                        ? ($isExpired ? 'Tu periodo de prueba ha terminado' : 'Tu prueba termina pronto')
                        : ($isExpired ? 'Suscripción vencida' : 'Tu suscripción vence pronto'),
                    'message' => $isTrial
                        ? ($isExpired
                            ? 'Tu periodo de prueba de Inventarya terminó. Selecciona un plan para continuar.'
                            : "Tu periodo de prueba de Inventarya vence en {$daysLeft} día(s).")
                        : ($isExpired
                            ? "Tu suscripción al plan {$planName} venció."
                            : "Tu plan {$planName} vence en {$daysLeft} día(s)."),
                    'type' => $type,
                    'severity' => $isExpired ? 'critical' : 'warning',
                    'days_left' => max(0, $daysLeft),
                    'plan_name' => $planName,
                    'subscription_id' => $sub->id,
                    'threshold' => $threshold,
                    'action_url' => '/settings',
                ];

                foreach ($owners as $owner) {
                    $notification = new SubscriptionExpiringNotification($payload);
                    $owner->notify($notification);

                    $pushNotificationService->sendToUser(
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
        }

        $this->info('Revisión de suscripciones finalizada exitosamente.');

        return 0;
    }
}
