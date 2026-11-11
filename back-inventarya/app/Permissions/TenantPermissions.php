<?php

namespace App\Permissions;

class TenantPermissions
{
    /**
     * Role capability matrix for Tenant users.
     */
    public const PERMISSIONS = [
        'owner' => [
            '*', // Wildcard: Owner has unrestricted access to everything in tenant
        ],
        'admin' => [
            // Admin can invite users, but cannot delete users or grant the owner role.
            'dashboard:access',
            'pos:access',

            // Stores (can view and update, CANNOT create or delete)
            'stores:view',
            'stores:view-all',
            'stores:update',

            // Users (can invite and update, CANNOT delete or grant owner)
            'users:view',
            'users:create',
            'users:update',

            // Products & Catalog
            'products:view',
            'products:create',
            'products:update',
            'products:delete',
            'categories:view',
            'categories:create',
            'categories:update',
            'categories:delete',
            'subcategories:view',
            'subcategories:create',
            'subcategories:update',
            'subcategories:delete',
            'brands:view',
            'brands:create',
            'brands:update',
            'brands:delete',

            // Suppliers
            'suppliers:view',
            'suppliers:create',
            'suppliers:update',
            'suppliers:delete',

            // Inventory & Warehouses
            'inventory:view',
            'inventory:view-all',
            'inventory:manage',

            // Sales & POS
            'sales:view',
            'sales:view-all',
            'sales:create',
            'sales:refund',
            'sales:cancel',
            'sales:update',
            'sales:delete',
            'sales:edit-price',

            // Customers
            'customers:view',
            'customers:create',
            'customers:update',
            'customers:delete',

            // Notifications & Reports
            'notifications:manage',
            'reports:view',
            'backup:download',
        ],
        'staff' => [
            // Staff works ONLY in assigned store
            'pos:access',
            'stores:view-assigned',
            'inventory:view-assigned',
            'sales:create',
            'sales:refund',
            'sales:view-assigned',
            'customers:view',
            'customers:create',
        ],
    ];

    /**
     * Check if a given tenant role has permission for an ability.
     */
    public static function can(string $role, string $ability): bool
    {
        $rolePermissions = self::PERMISSIONS[$role] ?? [];

        // Owner or any role with wildcard has access to everything
        if (in_array('*', $rolePermissions, true)) {
            return true;
        }

        return in_array($ability, $rolePermissions, true);
    }
}
