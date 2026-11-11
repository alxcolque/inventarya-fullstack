import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { CentralLayout } from '@/layouts/central/CentralLayout';
import { CentralGuard } from '@/layouts/central/CentralGuard';
import { SettingsPage as CentralSettingsPage } from '@/modules/central';
import { TenantLayout } from '@/layouts/tenant/TenantLayout';
import { TenantAdminGuard } from '@/layouts/tenant/TenantAdminGuard';
import { SettingsPage as TenantSettingsPage } from '@/modules/tenant/settings/pages/settings/index-settings';

/**
 * SettingsDispatcher — Resolves /settings based on active session context.
 * Central administrators get Central SaaS settings.
 * Tenant owners/administrators get Store/Business settings.
 */
export const SettingsDispatcher: React.FC = () => {
  const centralAuth = useCentralAuthStore((state) => state.authStatus);
  const tenantAuth = useTenantAuthStore((state) => state.authStatus);

  if (centralAuth === 'pending' || tenantAuth === 'pending') {
    return null;
  }

  if (centralAuth === 'auth') {
    return (
      <CentralGuard>
        <CentralLayout>
          <CentralSettingsPage />
        </CentralLayout>
      </CentralGuard>
    );
  }

  if (tenantAuth === 'auth') {
    return (
      <TenantAdminGuard>
        <TenantLayout>
          <TenantSettingsPage />
        </TenantLayout>
      </TenantAdminGuard>
    );
  }

  return <Navigate to="/login" replace />;
};
