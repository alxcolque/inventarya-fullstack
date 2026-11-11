import { Navigate, RouteObject } from 'react-router-dom';
import { CentralLayout } from '@/layouts/central/CentralLayout';
import { CentralGuard } from '@/layouts/central/CentralGuard';
import { LandingPage } from '@/pages/LandingPage';
import { TermsPage } from '@/pages/terms-page';
import { PrivacyPage } from '@/pages/privacy-page';
import { DeleteAccountPage } from '@/pages/delete-account-page';
import {
  AnalyticsDashboard,
  PaymentsPage,
  PlansPage,
  SubscriptionsPage,
  SupportPage,
  TenantsPage,
  AdministratorsPage,
  MonitoringPage,
  SettingsPage,
  DeveloperPage,
  ProfilePage,
  CarouselPage,
} from '@/modules/central';

import { PublicLayout } from '@/layouts/shared/PublicLayout';

/**
 * Central routes — loaded on central domain (localhost:5173 / admin.localhost / inventarya.com)
 * Root / is public SaaS Landing Page wrapped in existing PublicLayout.
 * /dashboard, /tenants, etc. require role: superadmin | support
 */
export const centralRoutes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/landing', element: <LandingPage /> },
      { path: '/terms', element: <TermsPage /> },
      { path: '/policy', element: <PrivacyPage /> },
      { path: '/terminos', element: <Navigate to="/terms" replace /> },
      { path: '/privacidad', element: <Navigate to="/policy" replace /> },
      { path: '/delete-account', element: <DeleteAccountPage /> },
      { path: '/eliminar-cuenta', element: <Navigate to="/delete-account" replace /> },
    ],
  },
  {
    element: <CentralGuard />,
    children: [
      {
        element: <CentralLayout />,
        children: [
          // Business
          { path: 'tenants',        element: <TenantsPage /> },
          { path: 'subscriptions',  element: <SubscriptionsPage /> },
          { path: 'plans',          element: <PlansPage /> },
          { path: 'payments',       element: <PaymentsPage /> },
          
          // Administration
          { path: 'support',        element: <SupportPage /> },
          { path: 'administrators', element: <AdministratorsPage /> },
          { path: 'monitoring',     element: <MonitoringPage /> },
          
          // System
          { path: 'developer',      element: <DeveloperPage /> },
          { path: 'settings',       element: <SettingsPage /> },
          { path: 'carousel',       element: <CarouselPage /> },
          
          // Profile
          { path: 'profile',        element: <ProfilePage /> },
        ],
      },
    ],
  },
];
