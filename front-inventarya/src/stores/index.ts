export { useCentralAuthStore } from "../modules/auth/store/centralAuth.store";
export { useTenantAuthStore } from "../modules/auth/store/tenantAuth.store";
// Backward-compat alias: all tenant modules import useAuthStore → points to tenant store
export { useTenantAuthStore as useAuthStore } from "../modules/auth/store/tenantAuth.store";

export { useSettingStore } from "../modules/tenant/settings/store/settings/settings.store";
export { useTermsStore } from "../modules/tenant/settings/store/terms/terms.store";
export { useCategoriesStore } from "../modules/tenant/products/store/categories/categories.store";
export { useProductsStore } from "../modules/tenant/products/store/products/products.store";
export { useStockStore } from "../modules/tenant/inventory/store/inventories/inv-shops.store";
export { useOrdersStore } from "../modules/tenant/sales/store/orders/orders.store";
export { useCustomerStore } from "../modules/tenant/customers/store/customer/customer.store";
export { useSupplierStore } from "../modules/tenant/suppliers/store/suppliers/suppliers.store";
export { useWarehouseStore } from "../modules/tenant/inventory/store/inventories/inv-warehouse.store";
export { useBrandsStore } from "../modules/tenant/products/store/brands/brands.store";
export { useLocationsStore } from "../modules/tenant/inventory/store/locations/locations.store";
export { useProductImagesStore } from "../modules/tenant/products/store/products/product-images.store";
export { useDetailSalesStore } from "../modules/tenant/sales/store/detail-sales/detail-sales.store";
export { useAssignmentsStore } from "../modules/tenant/pos/store/shops/assignments.store";
export { useShopsStore } from "../modules/tenant/pos/store/shops/shops.store";
export { useUsersStore } from "../modules/tenant/users/store/users/users.store";
export { useHomeStore } from "../modules/tenant/dashboard/store/home/home.store";
export { useCurrencyStore, useCurrency, getCurrencySymbol } from "./currency/currency.store";
