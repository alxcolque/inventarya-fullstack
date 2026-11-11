import { IUser } from "@/interface";

/**
 * Tenant Permissions
 * Roles: owner | admin | staff
 *
 * owner  → Acceso total al tenant (crear/eliminar tiendas, usuarios, configuraciones)
 * admin  → Puede invitar y actualizar usuarios, pero no eliminarlos ni asignar owner.
 * staff  → Sólo POS: ver tiendas asignadas, crear ventas, ver clientes
 */
export type TenantPermission =
  // Panel & App access
  | 'dashboard:access'
  | 'pos:access'

  // Stores
  | 'stores:view'
  | 'stores:view-all'
  | 'stores:view-assigned'
  | 'stores:create'
  | 'stores:update'
  | 'stores:delete'

  // Users
  | 'users:view'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'users:manage-roles'

  // Staff & Assignments
  | 'staff:create'
  | 'assignments:manage'

  // Products & Catalog
  | 'products:view'
  | 'products:create'
  | 'products:update'
  | 'products:delete'
  | 'categories:view'
  | 'categories:create'
  | 'categories:update'
  | 'categories:delete'
  | 'locations:view'
  | 'locations:create'
  | 'locations:update'
  | 'locations:delete'
  | 'brands:view'
  | 'brands:create'
  | 'brands:update'
  | 'brands:delete'

  // Suppliers
  | 'suppliers:view'
  | 'suppliers:create'
  | 'suppliers:update'
  | 'suppliers:delete'

  // Inventory
  | 'inventory:view'
  | 'inventory:view-all'
  | 'inventory:view-assigned'
  | 'inventory:manage'

  // Sales
  | 'sales:view'
  | 'sales:view-all'
  | 'sales:view-assigned'
  | 'sales:create'
  | 'sales:update'
  | 'sales:delete'
  | 'sales:cancel'

  // Customers
  | 'customers:view'
  | 'customers:create'
  | 'customers:update'
  | 'customers:delete'

  // Settings & System
  | 'settings:view'
  | 'settings:manage'
  | 'notifications:manage'
  | 'reports:view'
  | 'backup:download';

/**
 * Central Permissions
 */
export type CentralPermission =
  | 'central:access'
  | 'support:access'

  // Tenants
  | 'tenants:view'
  | 'tenants:create'
  | 'tenants:update'
  | 'tenants:delete'
  | 'database:manage'

  // Subscriptions & Plans
  | 'plans:view'
  | 'plans:manage'
  | 'subscriptions:view'
  | 'subscriptions:manage'

  // Payments
  | 'payments:view'
  | 'payments:confirm'
  | 'payments:manage'

  // Central Users & System
  | 'central-users:manage'
  | 'system:monitoring'
  | 'system:settings'
  | 'system:developer'
  | 'profile:manage';

export type AppPermission = TenantPermission | CentralPermission;

/**
 * Tenant Role Capability Matrix
 *
 * owner  → Todo (wildcard *)
 * admin  → Dashboard + POS + Gestión de catálogo, ventas, inventario, clientes, proveedores
 *           NO puede: crear/eliminar tiendas, eliminar usuarios o asignar owner
 * staff  → SÓLO POS: ver tiendas asignadas, crear ventas, ver/crear clientes
 */
export const TENANT_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'], // Acceso total al tenant

  admin: [
    // Acceso al panel y al POS
    'dashboard:access',
    'pos:access',

    // Tiendas: puede ver y actualizar, NO crear ni eliminar
    'stores:view',
    'stores:view-all',
    'stores:update',

    // Usuarios: puede invitar y actualizar, NO eliminar ni asignar owner
    'users:view',
    'users:create',
    'users:update',

    // Productos & Catálogo (gestión completa)
    'products:view',
    'products:create',
    'products:update',
    'products:delete',
    'categories:view',
    'categories:create',
    'categories:update',
    'categories:delete',
    'locations:view',
    'locations:create',
    'locations:update',
    'locations:delete',
    'brands:view',
    'brands:create',
    'brands:update',
    'brands:delete',

    // Proveedores (gestión completa)
    'suppliers:view',
    'suppliers:create',
    'suppliers:update',
    'suppliers:delete',

    // Inventario (gestión completa)
    'inventory:view',
    'inventory:view-all',
    'inventory:manage',

    // Ventas (gestión completa)
    'sales:view',
    'sales:view-all',
    'sales:create',
    'sales:update',
    'sales:delete',
    'sales:cancel',

    // Clientes (gestión completa)
    'customers:view',
    'customers:create',
    'customers:update',
    'customers:delete',

    // Reportes, Notificaciones y Configuraciones
    'settings:view',
    'settings:manage',
    'notifications:manage',
    'reports:view',
    'backup:download',
  ],

  staff: [
    // SÓLO acceso al POS, vista de productos, sucursales y operaciones de venta en tienda asignada
    'pos:access',
    'products:view',
    'stores:view',
    'stores:view-assigned',
    'inventory:view-assigned',
    'sales:create',
    'sales:view-assigned',
    'customers:view',
    'customers:create',
  ],

  worker: [
    // Alias idéntico a staff
    'pos:access',
    'products:view',
    'stores:view',
    'stores:view-assigned',
    'inventory:view-assigned',
    'sales:create',
    'sales:view-assigned',
    'customers:view',
    'customers:create',
  ],
};

/**
 * Central Role Capability Matrix
 */
export const CENTRAL_PERMISSIONS: Record<string, string[]> = {
  superadmin: ['*'], // Acceso total al SaaS
  support: [
    'central:access',
    'support:access',

    // Tenants (solo vista)
    'tenants:view',

    // Planes & Suscripciones (solo vista)
    'plans:view',
    'subscriptions:view',

    // Pagos (ver y confirmar)
    'payments:view',
    'payments:confirm',

    'profile:manage',
  ],
};

/**
 * Pure authorization check function for Tenant users.
 */
export function canTenant(user: IUser | null | undefined, permission: TenantPermission): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toLowerCase();
  const permissions = TENANT_PERMISSIONS[role] ?? [];

  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}

/**
 * Pure authorization check function for Central users.
 */
export function canCentral(user: IUser | null | undefined, permission: CentralPermission): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toLowerCase();
  const permissions = CENTRAL_PERMISSIONS[role] ?? [];

  if (permissions.includes('*')) return true;
  return permissions.includes(permission);
}
