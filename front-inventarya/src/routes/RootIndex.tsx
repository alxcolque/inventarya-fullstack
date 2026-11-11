import React from 'react';
import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { isCentral } from '@/utils/tenant';
import { LandingPage } from '@/pages/LandingPage';
import { Welcome } from '@/pages/Welcome';

import { PublicLayout } from '@/layouts/shared/PublicLayout';

/**
 * RootIndex — Fast entry dispatcher for the application.
 * - Mobile (Capacitor): Opens the WebApp immediately (to dashboard if logged in, or login if not).
 *   Never gets stuck on marketing pages.
 * - Web browser: Shows the commercial landing page for Central SaaS, or storefront for Tenants.
 */
export const RootIndex: React.FC = () => {
  const isCentralApp = isCentral();
  const isNative = Capacitor.isNativePlatform();

  const centralStatus = useCentralAuthStore((state) => state.authStatus);
  const tenantStatus = useTenantAuthStore((state) => state.authStatus);
  const tenantCan = useTenantAuthStore((state) => state.can);

  // 1. Mobile Capacitor App: Direct fast entry to WebApp
  if (isNative) {
    if (tenantStatus === 'auth') {
      return tenantCan('dashboard:access')
        ? <Navigate to="/dashboard" replace />
        : <Navigate to="/shops" replace />;
    }
    if (centralStatus === 'auth') {
      return <Navigate to="/dashboard" replace />;
    }
    // Instant entry to login screen on mobile
    return <Navigate to="/login" replace />;
  }

  // 2. Web Browser: Check active session
  if (tenantStatus === 'auth') {
    return tenantCan('dashboard:access')
      ? <Navigate to="/dashboard" replace />
      : <Navigate to="/shops" replace />;
  }
  if (centralStatus === 'auth') {
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Web Browser without session:
  if (isCentralApp) {
    return (
      <PublicLayout>
        <LandingPage />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <Welcome />
    </PublicLayout>
  );
};
