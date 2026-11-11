import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar/sidebar';
import { NavbarComponent } from '@/components/navbar/navbar-component';
import { LayoutProvider } from '@/context/layout-context';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { useSettingStore } from '@/modules/tenant/settings/store/settings/settings.store';
import { useShopsStore } from '@/modules/tenant/pos/store/shops/shops.store';
import { TenantPermission } from '@/utils/permissions';
import { applyPrimaryColorTheme } from '@/utils/themeColor';
import {
  LuLayoutDashboard,
  LuPackage,
  LuWarehouse,
  LuReceipt,
  LuUsers,
  LuFolderTree,
  LuUserCheck,
  LuTruck,
  LuStore,
  LuSettings,
  LuMapPin,
  LuTag,
  LuCreditCard,
  LuBell,
} from "react-icons/lu";

interface NavItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  permission?: TenantPermission;
}

interface NavSection {
  section?: string;
  items: NavItem[];
}

export const TenantLayout = ({ children }: { children?: React.ReactNode }) => {
  const can = useTenantAuthStore(state => state.can);
  const setting = useSettingStore(state => state.setting);
  const systemData = useSettingStore(state => state.systemData);
  const currentSetting = setting || systemData;

  const shops = useShopsStore(state => state.shops);
  const getShops = useShopsStore(state => state.getShops);

  useEffect(() => {
    getShops();
  }, [getShops]);

  useEffect(() => {
    if (currentSetting?.primary_color) {
      applyPrimaryColorTheme(currentSetting.primary_color);
    }
  }, [currentSetting?.primary_color]);

  const enableCustomers = Boolean(currentSetting?.enable_customers);
  const enableSuppliers = Boolean(currentSetting?.enable_suppliers);
  const enableLocations = Boolean(currentSetting?.enable_locations);

  const brandTitle = systemData?.name || "Inventarya";
  const brandLogo = systemData?.logo || "/favicon.ico";

  const rawSections: NavSection[] = [
    {
      section: "Operaciones",
      items: [
        { title: "Panel", icon: <LuLayoutDashboard size={20} />, href: "/dashboard", permission: "dashboard:access" },
        { title: "Productos Almacén", icon: <LuWarehouse size={20} />, href: "/inventories", permission: "inventory:view" },
        { title: "Lista Productos", icon: <LuPackage size={20} />, href: "/products", permission: "dashboard:access" },
        { title: "Categorías", icon: <LuFolderTree size={20} />, href: "/categories", permission: "categories:view" },
        { title: "Marcas", icon: <LuTag size={20} />, href: "/brands", permission: "brands:view" },
        { title: "Ubicaciones", icon: <LuMapPin size={20} />, href: "/locations", permission: "locations:view" },
        { title: "Ventas", icon: <LuReceipt size={20} />, href: "/sales", permission: "sales:view" },
        { title: "Clientes", icon: <LuUserCheck size={20} />, href: "/customers", permission: "customers:view" },
        { title: "Proveedores", icon: <LuTruck size={20} />, href: "/suppliers", permission: "suppliers:view" },
      ]
    },
    {
      section: 'Comunicación',
      items: [
        { title: 'Notificaciones', icon: <LuBell size={20} />, href: '/notification-management', permission: 'notifications:manage' },
      ]
    },
    {
      section: "Administración",
      items: [
        { title: "Tiendas", icon: <LuStore size={20} />, href: "/shops", permission: "stores:view" },
        { title: "Usuarios", icon: <LuUsers size={20} />, href: "/users", permission: "users:view" },
        { title: "Configuración", icon: <LuSettings size={20} />, href: "/settings", permission: "settings:manage" },
        { title: "Mi Plan", icon: <LuCreditCard size={20} />, href: "/my-plan", permission: "settings:manage" },
      ]
    }
  ];

  const visibleSections = rawSections
    .map(sec => ({
      ...sec,
      items: sec.items.filter(item => {
        if (item.href === "/customers" && !enableCustomers) return false;
        if (item.href === "/suppliers" && !enableSuppliers) return false;
        if (item.href === "/locations" && !enableLocations) return false;
        return !item.permission || can(item.permission);
      })
    }))
    .filter(sec => sec.items.length > 0);

  return (
    <LayoutProvider>
      <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden">
        <Sidebar
          title={brandTitle}
          subtitle="Panel de Tienda"
          logo={brandLogo}
          links={visibleSections}
          shops={shops}
          showPosDropdown={true}
        />
        <div className="flex flex-col flex-1 relative overflow-y-auto">
          <NavbarComponent />
          <main className="p-4 md:p-8">
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </LayoutProvider>
  );
};
