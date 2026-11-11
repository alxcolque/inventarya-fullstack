import { Navigate, RouteObject } from 'react-router-dom';
import { PublicLayout } from '@/layouts/shared/PublicLayout';
import { Welcome } from '@/pages/Welcome';
import { LandingPage } from '@/pages/LandingPage';
import { ErrorPage } from '@/pages/errors/404';
import { PrivacyPage } from '@/pages/privacy-page';
import { TermsPage } from '@/pages/terms-page';
import { DeleteAccountPage } from '@/pages/delete-account-page';
import { ShowProduct } from '@/modules/tenant/pos/pages/pos/show-product';
import { ShopHome } from '@/modules/tenant/pos/pages/pos/shop-home';
import { DetailSale } from '@/modules/tenant/sales/pages/sales/detail-sale';
import { KardexProduct } from '@/modules/tenant/pos/pages/pos/kardex-product';
import { AuthLayout } from '@/layouts/auth/AuthLayout';
import ActivateAccount from '@/pages/auth/ActivateAccount';

/**
 * Public routes — accessible without authentication.
 * Only loaded on tenant subdomains.
 * 
 * NOTE: /pos and /tienda routes here use PublicLayout (no auth required).
 * Authenticated users (staff/admin/owner) are redirected to the appropriate
 * guarded route that wraps them in PosLayout or TenantLayout.
 */
export const publicRoutes: RouteObject[] = [
  { path: '/landing', element: <LandingPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: '/activate-account', element: <ActivateAccount /> },
    ],
  },
  {
    element: <PublicLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/terms',      element: <TermsPage /> },
      { path: '/policy',     element: <PrivacyPage /> },
      { path: '/privacidad', element: <Navigate to="/policy" replace /> },
      { path: '/terminos',   element: <Navigate to="/terms" replace /> },
      { path: '/delete-account',  element: <DeleteAccountPage /> },
      { path: '/eliminar-cuenta', element: <Navigate to="/delete-account" replace /> },
      { path: '/productos/:slug', element: <ShowProduct /> },
      {
        path: 'tienda',
        children: [
          { path: '',                         element: <Welcome /> },
          { path: ':slug',                    element: <ShopHome /> },
          { path: ':slug/venta/:id',          element: <DetailSale /> },
          { path: ':slug/:productSlug',       element: <KardexProduct /> },
        ],
      },
    ],
  },
];
