import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/sidebar/sidebar';
import { NavbarComponent } from '@/components/navbar/navbar-component';
import { LayoutProvider } from '@/context/layout-context';
import { useCentralAuthStore } from '@/modules/auth/store/centralAuth.store';
import { CentralPermission } from '@/utils/permissions';
import { 
  LuLayoutDashboard, 
  LuBuilding2, 
  LuClipboardList, 
  LuRefreshCw, 
  LuCreditCard, 
  LuLifeBuoy,
  LuUsers,
  LuActivity,
  LuSettings,
  LuCode,
  LuUser,
  LuLayoutTemplate,
  LuBriefcase,
} from "react-icons/lu";

interface NavItem {
  title: string;
  icon: React.ReactNode;
  href: string;
  permission?: CentralPermission;
}

interface NavSection {
  section?: string;
  items: NavItem[];
}

export const CentralLayout = ({ children }: { children?: React.ReactNode }) => {
  const can = useCentralAuthStore(state => state.can);

  const rawSections: NavSection[] = [
    {
      items: [
        { title: "Dashboard", icon: <LuLayoutDashboard size={20} />, href: "/dashboard", permission: "central:access" },
      ]
    },
    {
      section: "Business",
      items: [
        { title: "Tenants",       icon: <LuBuilding2 size={20} />,       href: "/tenants",        permission: "tenants:view" },
        { title: "Tipos de Negocio", icon: <LuBriefcase size={20} />,    href: "/business-types", permission: "business-types:view" },
        { title: "Subscriptions", icon: <LuRefreshCw size={20} />,       href: "/subscriptions",  permission: "subscriptions:view" },
        { title: "Plans",         icon: <LuClipboardList size={20} />,    href: "/plans",         permission: "plans:view" },
        { title: "Payments",      icon: <LuCreditCard size={20} />,       href: "/payments",      permission: "payments:view" },
      ]
    },
    {
      section: "Administration",
      items: [
        { title: "Support",       icon: <LuLifeBuoy size={20} />,        href: "/support",        permission: "support:access" },
        { title: "Administrators",icon: <LuUsers size={20} />,           href: "/administrators", permission: "central-users:manage" },
        { title: "Monitoring",    icon: <LuActivity size={20} />,        href: "/monitoring",     permission: "system:monitoring" },
      ]
    },
    {
      section: "System",
      items: [
        { title: "Settings",      icon: <LuSettings size={20} />,       href: "/settings",       permission: "system:settings" },
        { title: "Carrusel",      icon: <LuLayoutTemplate size={20} />, href: "/carousel",       permission: "system:settings" },
        { title: "Developer",     icon: <LuCode size={20} />,           href: "/developer",      permission: "system:developer" },
      ]
    },
    {
      items: [
        { title: "Profile",       icon: <LuUser size={20} />,            href: "/profile",        permission: "profile:manage" },
      ]
    }
  ];

  // Filter sections and items based on can() capabilities
  const visibleSections = rawSections
    .map(sec => ({
      ...sec,
      items: sec.items.filter(item => !item.permission || can(item.permission))
    }))
    .filter(sec => sec.items.length > 0);

  return (
    <LayoutProvider>
      <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden">
        <Sidebar 
          title="Inventarya" 
          subtitle="Panel Central" 
          logo="/branding/logo-inventarya.png"
          links={visibleSections}
          showPosDropdown={false}
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
