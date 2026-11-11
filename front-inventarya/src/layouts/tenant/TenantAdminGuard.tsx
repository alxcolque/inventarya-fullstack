import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';

/**
 * TenantAdminGuard — Protects tenant admin/management routes.
 *
 * Permission required: `dashboard:access`
 * Roles with this permission: admin | owner
 *
 * Note: `staff` does NOT have `dashboard:access` — they are redirected
 * to /pos after login via their own WorkerGuard route.
 *
 * EXCEPTION: Product detail route (/products/:id) can be accessed
 * in read-only mode by staff.
 *
 * Behaviour:
 * - `pending`   → render nothing while auth is being checked
 * - `not-auth`  → redirect to /login
 * - `auth` but no `dashboard:access` → allow if product detail (/products/:id), otherwise redirect to /pos
 * - `auth` with `dashboard:access`   → render children via <Outlet />
 */
export const TenantAdminGuard = ({ children }: { children?: React.ReactNode }) => {
  const authStatus = useTenantAuthStore(state => state.authStatus);
  const can = useTenantAuthStore(state => state.can);
  const location = useLocation();

  // Still loading / checking token — render nothing to avoid flicker
  if (authStatus === 'pending') return null;

  // Not authenticated → go to login
  if (authStatus !== 'auth') {
    return <Navigate to="/login" replace />;
  }

  // Allow product detail view (read-only) and shops/POS selector for staff
  const isProductDetail = /^\/products\/[^/]+$/.test(location.pathname);
  const isShops = location.pathname === '/shops' || location.pathname === '/stores';
  const isStaffAllowedRoute = isProductDetail || isShops;

  // Authenticated but no admin panel access → redirect staff to /shops (unless on an allowed route)
  if (!can('dashboard:access') && !isStaffAllowedRoute) {
    return <Navigate to="/shops" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
