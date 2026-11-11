import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';

/**
 * WorkerGuard — Protects POS routes.
 *
 * Permission required: `pos:access`
 * Roles with this permission: staff | admin | owner
 *
 * Behaviour:
 * - `pending`   → render nothing while auth is being checked
 * - `not-auth`  → redirect to /login
 * - `auth` but no `pos:access` → redirect to /login (shouldn't normally happen)
 * - `auth` with `pos:access`   → render children via <Outlet />
 */
export const WorkerGuard = () => {
  const authStatus = useTenantAuthStore(state => state.authStatus);
  const can = useTenantAuthStore(state => state.can);

  // Still loading / checking token — render nothing to avoid flicker
  if (authStatus === 'pending') return null;

  if (authStatus !== 'auth' || !can('pos:access')) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
