import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { CentralLayout } from '@/layouts/central/CentralLayout';
import { CentralGuard } from '@/layouts/central/CentralGuard';
import { AnalyticsDashboard } from '@/modules/central';
import { TenantLayout } from '@/layouts/tenant/TenantLayout';
import { TenantAdminGuard } from '@/layouts/tenant/TenantAdminGuard';
import { HomeIndex } from '@/modules/tenant/dashboard/pages/home/home-index';

/**
 * DashboardDispatcher — Dispatches /dashboard to Central or Tenant dashboard
 * based on authenticated session context. Prevents guard conflicts on shared domains.
 */
export const DashboardDispatcher: React.FC = () => {
  const centralAuth = useCentralAuthStore((state) => state.authStatus);
  const tenantAuth = useTenantAuthStore((state) => state.authStatus);

  if (centralAuth === 'pending' || tenantAuth === 'pending') {
    return null;
  }

  if (centralAuth === 'auth') {
    return (
      <CentralGuard>
        <CentralLayout>
          <AnalyticsDashboard />
        </CentralLayout>
      </CentralGuard>
    );
  }

  if (tenantAuth === 'auth') {
    return (
      <TenantAdminGuard>
        <TenantLayout>
          <HomeIndex />
        </TenantLayout>
      </TenantAdminGuard>
    );
  }

  // Not authenticated: redirect to login
  return <Navigate to="/login" replace />;
};
