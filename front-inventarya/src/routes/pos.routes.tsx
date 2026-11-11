import { Navigate, RouteObject } from 'react-router-dom';
import { PosLayout } from '@/layouts/pos/PosLayout';
import { WorkerGuard } from '@/layouts/tenant/WorkerGuard';
import { IndexShops } from '@/modules/tenant/settings/pages/shops/index-shops';
import { ShopHome } from '@/modules/tenant/pos/pages/pos/shop-home';
import { IndexSale } from '@/modules/tenant/sales/pages/sales/index-sale';
import { DetailSale } from '@/modules/tenant/sales/pages/sales/detail-sale';
import { KardexProduct } from '@/modules/tenant/pos/pages/pos/kardex-product';

/**
 * Rutas exclusivas del Punto de Venta (POS) — protegidas por WorkerGuard.
 * 
 * Requisito: Permiso `pos:access` (roles: staff | admin | owner)
 * Utiliza PosLayout: layout de pantalla completa sin sidebar, con navbar superior y barra inferior en tablet/móvil.
 */
export const posRoutes: RouteObject[] = [
  {
    path: '/',
    element: <WorkerGuard />,
    children: [
      {
        element: <PosLayout />,
        children: [
          // Selección de sucursales / terminales POS
          { path: 'tienda',                           element: <IndexShops /> },
          { path: 'pos',                              element: <Navigate to="/tienda" replace /> },

          // Terminal POS por sucursal
          { path: 'tienda/:slug',                     element: <ShopHome /> },
          { path: 'tienda/:slug/ventas',              element: <IndexSale /> },
          { path: 'tienda/:slug/ventas/detalle/:id',  element: <DetailSale /> },
          { path: 'tienda/:slug/venta/:id',          element: <DetailSale /> },
          { path: 'tienda/:slug/:productSlug',        element: <KardexProduct /> },

          // Alias canónico /pos/:slug
          { path: 'pos/:slug',                        element: <ShopHome /> },
          { path: 'pos/:slug/ventas',                 element: <IndexSale /> },
          { path: 'pos/:slug/ventas/detalle/:id',     element: <DetailSale /> },
          { path: 'pos/:slug/venta/:id',             element: <DetailSale /> },
          { path: 'pos/:slug/:productSlug',           element: <KardexProduct /> },
        ],
      },
    ],
  },
];
