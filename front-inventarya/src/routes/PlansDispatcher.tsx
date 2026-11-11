import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { CentralLayout } from '@/layouts/central/CentralLayout';
import { CentralGuard } from '@/layouts/central/CentralGuard';
import { PlansPage } from '@/modules/central';
import { TenantLayout } from '@/layouts/tenant/TenantLayout';
import { TenantAdminGuard } from '@/layouts/tenant/TenantAdminGuard';
import { MyPlanPage } from '@/modules/tenant/settings/pages/plan/MyPlanPage';
import { isCentral } from '@/utils/tenant';

/**
 * PlansDispatcher — Resolves /plans based on active session context and domain.
 * - Central superadmin / support: renders SaaS Plans management page.
 * - Tenant owner / admin: renders MyPlanPage.
 */
export const PlansDispatcher: React.FC = () => {
  const centralAuth = useCentralAuthStore((state) => state.authStatus);
  const tenantAuth = useTenantAuthStore((state) => state.authStatus);

  // Still rehydrating session from storage — avoid premature redirect to /login
  if (centralAuth === 'pending' || tenantAuth === 'pending') {
    return null;
  }

  // 1. Central session active -> Central SaaS Plans management
  if (centralAuth === 'auth') {
    return (
      <CentralGuard>
        <CentralLayout>
          <PlansPage />
        </CentralLayout>
      </CentralGuard>
    );
  }

  // 2. Tenant session active -> Tenant plan information
  if (tenantAuth === 'auth') {
    return (
      <TenantAdminGuard>
        <TenantLayout>
          <MyPlanPage />
        </TenantLayout>
      </TenantAdminGuard>
    );
  }

  // 3. Central domain fallback without auth -> CentralGuard will redirect appropriately
  if (isCentral()) {
    return (
      <CentralGuard>
        <CentralLayout>
          <PlansPage />
        </CentralLayout>
      </CentralGuard>
    );
  }

  // 4. Default: redirect to login
  return <Navigate to="/login" replace />;
};
