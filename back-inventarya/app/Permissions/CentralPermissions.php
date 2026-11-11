<?php

namespace App\Permissions;

class CentralPermissions
{
    /**
     * Role capability matrix for Central users.
     */
    public const PERMISSIONS = [
        'superadmin' => [
            '*', // Wildcard: Superadmin has unrestricted access to everything in Central
        ],
        'support' => [
            'central:access',
            'support:access',

            // Tenants (view only)
            'tenants:view',

            // Subscriptions & Plans (view only)
            'plans:view',
            'subscriptions:view',

            // Payments (view and confirm)
            'payments:view',
            'payments:confirm',

            // Profile
            'profile:manage',
        ],
    ];

    /**
     * Check if a given central role has permission for an ability.
     */
    public static function can(string $role, string $ability): bool
    {
        $rolePermissions = self::PERMISSIONS[$role] ?? [];

        // Wildcard check
        if (in_array('*', $rolePermissions, true)) {
            return true;
        }

        return in_array($ability, $rolePermissions, true);
    }
}
