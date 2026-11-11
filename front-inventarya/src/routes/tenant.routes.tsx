import { Navigate, RouteObject, useParams } from 'react-router-dom';

const RedirectStoreDetail = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/shops/${id}`} replace />;
};
import { TenantLayout } from '@/layouts/tenant/TenantLayout';
import { TenantAdminGuard } from '@/layouts/tenant/TenantAdminGuard';

import { IndexProducts } from '@/modules/tenant/products/pages/products/index-products';
import { CreateProduct } from '@/modules/tenant/products/pages/products/create-product';
import { ShowProducts } from '@/modules/tenant/products/pages/products/show-products';
import { IndexCategories } from '@/modules/tenant/products/pages/categories/index-categories';
import { ShowCategories } from '@/modules/tenant/products/pages/categories/show.categories';
import { IndexBrands } from '@/modules/tenant/products/pages/brands/index-brands';
import { ShowBrands } from '@/modules/tenant/products/pages/brands/show-brands';
import { IndexCustomers } from '@/modules/tenant/customers/pages/customers/index-customers';
import { ShowCustomers } from '@/modules/tenant/customers/pages/customers/show-customers';
import { IndexSuppliers } from '@/modules/tenant/suppliers/pages/suppliers/index-suppliers';
import { ShowSuppliers } from '@/modules/tenant/suppliers/pages/suppliers/show-suppliers';
import { IndexInventories } from '@/modules/tenant/inventory/pages/inventories/index-inventories';
import { IndexLocations } from '@/modules/tenant/inventory/pages/locations/index-locations';
import { InputForm } from '@/modules/tenant/inventory/pages/inventories/input-form';
import { KardexProductWarehouse } from '@/modules/tenant/inventory/pages/inventories/kardex-product-warehouse';
import { KardexProduct } from '@/modules/tenant/pos/pages/pos/kardex-product';
import { IndexSale } from '@/modules/tenant/sales/pages/sales/index-sale';
import { IndexOrders } from '@/modules/tenant/sales/pages/orders/index-orders';
import { IndexUsers } from '@/modules/tenant/users/pages/users/index-users';
import { ShowUsers } from '@/modules/tenant/users/pages/users/show-users';

import { Terms } from '@/modules/tenant/settings/pages/terms/terms';
import { MyPlanPage } from '@/modules/tenant/settings/pages/plan/MyPlanPage';
import { IndexShops } from '@/modules/tenant/settings/pages/shops/index-shops';
import { ShowShops } from '@/modules/tenant/settings/pages/shops/show-shops';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { NotificationManagementPage } from '@/modules/tenant/notifications';

/**
 * Tenant admin routes — only loaded on tenant subdomains.
 * Requires: `dashboard:access` permission (role: admin | owner)
 * Wrapped in TenantLayout (has LayoutProvider + full admin Sidebar).
 */
export const tenantRoutes: RouteObject[] = [
  {
    path: '/',
    element: <TenantAdminGuard />,
    children: [
      {
        element: <TenantLayout />,
        children: [

          // Products & Catalog
          { path: 'products',               element: <IndexProducts /> },
          { path: 'products/create',        element: <CreateProduct /> },
          { path: 'products/:id/edit',      element: <CreateProduct /> },
          { path: 'products/:id',           element: <ShowProducts /> },
          { path: 'categories',             element: <IndexCategories /> },
          { path: 'categories/:id',         element: <ShowCategories /> },
          { path: 'locations',              element: <IndexLocations /> },
          { path: 'brands',                 element: <IndexBrands /> },
          { path: 'brands/:id',             element: <ShowBrands /> },

          // Customers & Suppliers
          { path: 'customers',              element: <IndexCustomers /> },
          { path: 'customers/:id',          element: <ShowCustomers /> },
          { path: 'suppliers',              element: <IndexSuppliers /> },
          { path: 'suppliers/:id',          element: <ShowSuppliers /> },

          // Inventories
          { path: 'inventories',            element: <IndexInventories /> },
          { path: 'inventories/input',      element: <InputForm /> },
          { path: 'inventories/cardex/:id', element: <KardexProduct /> },
          { path: 'inventories/:slug',      element: <KardexProductWarehouse /> },
          // Alias for backward compatibility
          { path: 'inventory',              element: <IndexInventories /> },
          { path: 'inventory/input',        element: <InputForm /> },
          { path: 'inventory/:slug',        element: <KardexProductWarehouse /> },

          // Sales & Orders
          { path: 'sales',                  element: <IndexSale /> },
          { path: 'orders',                 element: <IndexOrders /> },

          // Notifications
          { path: 'notifications',          element: <NotificationsPage /> },
          { path: 'notification-management', element: <NotificationManagementPage /> },

          // Users (Admin/Owner manage users)
          { path: 'users',                  element: <IndexUsers /> },
          { path: 'users/:id',              element: <ShowUsers /> },

          // Settings & Plans
          { path: 'my-plan',                element: <MyPlanPage /> },
          { path: 'company-terms/:id',      element: <Terms /> },

          // Stores / Shops Management (Admin/Owner can view/manage assignments)
          { path: 'shops',                  element: <IndexShops /> },
          { path: 'stores',                 element: <Navigate to="/shops" replace /> },
          { path: 'shops/:id',              element: <ShowShops /> },
          { path: 'stores/:id',             element: <RedirectStoreDetail /> },
        ],
      },
    ],
  },
];
