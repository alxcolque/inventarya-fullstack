import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';

/**
 * CentralGuard - Protects central SaaS management routes.
 * Evaluates capability via can('central:access').
 */
export const CentralGuard = ({ children }: { children?: React.ReactNode }) => {
  const authStatus = useCentralAuthStore(state => state.authStatus);
  const can = useCentralAuthStore(state => state.can);

  // Still rehydrating from localStorage — wait silently
  if (authStatus === 'pending') return null;

  // Not authenticated or missing capability → redirect to login
  if (authStatus !== 'auth' || !can('central:access')) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
