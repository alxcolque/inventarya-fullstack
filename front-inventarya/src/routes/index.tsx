/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Inventarya — Unified Professional Router
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides instant, zero-latency startup on Android/Capacitor while preserving
 * full multi-tenant capabilities for Central SaaS and Tenant stores.
 */
import { createBrowserRouter, Navigate, RouteObject } from 'react-router-dom';
import App from '@/App';
import { RootErrorBoundary } from '@/components/common/RootErrorBoundary';

// Entry dispatchers
import { RootIndex } from './RootIndex';
import { DashboardDispatcher } from './DashboardDispatcher';
import { SettingsDispatcher } from './SettingsDispatcher';
import { PlansDispatcher } from './PlansDispatcher';

// Route groups
import { authRoutes } from './auth.routes';
import { posRoutes } from './pos.routes';
import { tenantRoutes } from './tenant.routes';
import { centralRoutes } from './central.routes';
import { publicRoutes } from './public.routes';

const appRoutes: RouteObject[] = [
  // 1. Instant root entry (fast dispatcher for mobile & web)
  { path: '/', element: <RootIndex /> },
  { path: '/index.html', element: <Navigate to="/" replace /> },

  // 2. Shared context dispatchers
  { path: '/dashboard', element: <DashboardDispatcher /> },
  { path: '/settings', element: <SettingsDispatcher /> },
  { path: '/plans', element: <PlansDispatcher /> },

  // 3. Auth routes (/login)
  ...authRoutes,

  // 4. POS Terminal routes (/shops, /pos, /tienda/:slug)
  ...posRoutes,

  // 5. Tenant admin routes (/products, /categories, /sales, /users, etc.)
  ...tenantRoutes,

  // 6. Central SaaS management routes (/tenants, /plans, /subscriptions, etc.)
  ...centralRoutes,

  // 7. Public tenant routes (/activate-account, /terms, /policy, /tienda/:slug, etc.)
  ...publicRoutes,

  // 8. Catch-all fallback
  { path: '*', element: <Navigate to="/" replace /> },
];

const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: <RootErrorBoundary />,
    children: appRoutes,
  },
]);

export default router;
