<?php

namespace App\Services\Notifications;

use App\Models\Assignment;
use App\Models\CentralUser;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * NotificationRecipientResolver
 *
 * Centraliza la lógica de determinación de destinatarios para notificaciones
 * en Central y Tenant, desacoplando los controladores y modelos de la entrega.
 */
class NotificationRecipientResolver
{
    /**
     * Resolver la audiencia de una notificación manual del tenant.
     */
    public function manualTenantRecipients(
        string $audience,
        array $userIds = [],
        array $roles = []
    ): Collection {
        if (! tenant()) {
            throw new \LogicException('No se pueden resolver destinatarios tenant sin inicializar el tenant.');
        }

        $query = User::query()->where('status', 'active');

        match ($audience) {
            'admins' => $query->whereIn('role', ['owner', 'admin']),
            'roles' => $query->whereIn('role', $roles),
            'users' => $query->whereIn('id', array_values(array_unique($userIds))),
            default => null,
        };

        return $query->orderBy('name')->get();
    }

    /**
     * Obtener administradores de la plataforma central (super_admin y support).
     */
    public function centralAdmins(): Collection
    {
        return CentralUser::query()
            ->whereIn('role', ['super_admin', 'support'])
            ->where('status', 'active')
            ->get();
    }

    /**
     * Obtener sólo el super_admin central.
     */
    public function centralSuperAdmins(): Collection
    {
        return CentralUser::query()
            ->where('role', 'super_admin')
            ->where('status', 'active')
            ->get();
    }

    /**
     * Obtener dueños (owner) del tenant actual.
     */
    public function tenantOwners(): Collection
    {
        return User::query()
            ->where('role', 'owner')
            ->where('status', 'active')
            ->get();
    }

    /**
     * Obtener administradores operativos y dueños (owner + admin) del tenant actual.
     */
    public function tenantAdmins(): Collection
    {
        return User::query()
            ->whereIn('role', ['owner', 'admin'])
            ->where('status', 'active')
            ->get();
    }

    /**
     * Obtener trabajadores (staff / worker) asignados a una tienda/sucursal específica.
     */
    public function tenantStaffForStore($storeId): Collection
    {
        if (empty($storeId)) {
            return collect();
        }

        $userIds = Assignment::where('store_id', $storeId)->pluck('user_id');

        return User::query()
            ->whereIn('id', $userIds)
            ->whereIn('role', ['staff', 'worker'])
            ->where('status', 'active')
            ->get();
    }

    /**
     * Resolver destinatarios para alertas de inventario (Stock mínimo, agotado, etc.).
     * - Dueños y administradores siempre reciben alertas de stock.
     * - Personal (staff) únicamente si está asignado a la tienda donde ocurrió la alerta.
     */
    public function tenantInventoryRecipients($storeId = null): Collection
    {
        $recipients = $this->tenantAdmins();

        if ($storeId) {
            $staff = $this->tenantStaffForStore($storeId);
            $recipients = $recipients->merge($staff);
        }

        return $recipients->unique('id');
    }

    /**
     * Resolver destinatarios para eventos de venta en tenant.
     * Dueños y administradores reciben notificación de ventas.
     */
    public function tenantSaleRecipients($storeId = null): Collection
    {
        return $this->tenantAdmins();
    }
}
