import React, { useEffect } from "react";
import {
  SidebarStyles,
  SidebarHeaderStyles,
  SidebarBodyStyles,
  SidebarFooterStyles,
  SidebarOverlayStyles,
  SidebarItemStyles,
} from "./sidebar.styles";
import { SidebarItem } from "./sidebar-item";
import { SidebarMenu } from "./sidebar-menu";
import { useSidebarContext } from "@/context/layout-context";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
} from "@nextui-org/react";
import { LuX, LuChevronLeft, LuChevronRight, LuStore, LuChevronDown } from "react-icons/lu";
import { AppLogo, INVENTARYA_LOGO_PATH } from "@/components/branding/AppLogo";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { IShopResponse } from "@/modules/tenant/pos/interfaces/shops/shop-response";
import { getImageUrl } from "@/utils";

interface Props {
  title?: string;
  subtitle?: string;
  logo?: string;
  links: {
    section?: string;
    items: {
      title: string;
      icon: React.ReactNode;
      href: string;
    }[];
  }[];
  shops?: IShopResponse[];
  showPosDropdown?: boolean;
}

export const Sidebar = ({
  title = "Inventarya",
  subtitle,
  logo,
  links,
  shops: propShops,
  showPosDropdown = true,
}: Props) => {
  const { collapsed, setCollapsed, isCompact, toggleCompact } = useSidebarContext();
  const navigate = useNavigate();
  const location = useLocation();

  const storeShops = useShopsStore((state) => state.shops);
  const getShops = useShopsStore((state) => state.getShops);

  useEffect(() => {
    if (showPosDropdown && (!storeShops || storeShops.length === 0)) {
      getShops();
    }
  }, [showPosDropdown, storeShops, getShops]);

  const effectiveShops = propShops ?? storeShops;
  const hasShops = Boolean(showPosDropdown && effectiveShops && effectiveShops.length > 0);

  const brandLogo = logo || INVENTARYA_LOGO_PATH;
  const brandTitle = title || "Inventarya";

  const isPosActive =
    location.pathname.startsWith("/tienda") || location.pathname.startsWith("/pos");

  return (
    <aside
      className={`h-[100dvh] max-h-[100dvh] ${
        collapsed ? "z-[25] pointer-events-auto" : "z-0 pointer-events-none md:pointer-events-auto"
      } md:z-[20] sticky top-0 shrink-0`}
    >
      {/* Mobile backdrop overlay */}
      {collapsed ? (
        <div
          className={SidebarOverlayStyles()}
          onClick={() => setCollapsed(false)}
          aria-hidden="true"
        />
      ) : null}

      <div
        data-sidebar-scroll="true"
        className={SidebarStyles({
          collapsed: collapsed,
          compact: isCompact,
        })}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Sidebar Header: Logo & Branding */}
        <div className={SidebarHeaderStyles()}>
          <div className="flex items-center justify-between w-full gap-2 px-1">
            <div
              className="flex items-center gap-3 cursor-pointer group select-none min-w-0"
              onClick={() => {
                navigate("/dashboard");
                if (window.innerWidth < 768) setCollapsed(false);
              }}
              title={brandTitle}
            >
              {/* Logo icon container */}
              <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-content2 border border-divider shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
                <AppLogo
                  src={brandLogo}
                  alt={brandTitle}
                  className="w-7 h-7 rounded-md"
                />
              </div>

              {/* Title & Subtitle (hidden in compact mode) */}
              {!isCompact && (
                <div className="flex flex-col min-w-0">
                  <h3 className="text-base font-extrabold text-foreground tracking-tight m-0 leading-tight truncate">
                    {brandTitle}
                  </h3>
                  {subtitle && (
                    <span className="text-[11px] font-semibold text-default-400 tracking-tight truncate uppercase">
                      {subtitle}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Mobile close button ('X') */}
            <Button
              isIconOnly
              size="sm"
              variant="light"
              className="md:hidden text-default-500 hover:text-foreground shrink-0"
              onPress={() => setCollapsed(false)}
              aria-label="Cerrar menú"
            >
              <LuX className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Sidebar Body: Scrollable Navigation Items (Invisible scrollbar & flexible) */}
        <div
          data-sidebar-body="true"
          className={SidebarBodyStyles()}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* 1. Punto de Venta Dropdown (se muestra SOLO si existen tiendas registradas) */}
          {hasShops && (
            <div className="flex flex-col gap-1 pb-1">
              {!isCompact ? (
                <span className="text-[11px] font-bold text-default-400 uppercase tracking-wider px-3.5 pt-1 pb-0.5 select-none">
                  Punto de Venta
                </span>
              ) : (
                <div className="w-7 h-[1px] bg-divider/80 mx-auto my-1" />
              )}

              <Dropdown
                placement={isCompact ? "right-start" : "bottom-start"}
                offset={isCompact ? 14 : 6}
                classNames={{
                  content:
                    "z-[300] bg-content1 border border-divider shadow-2xl rounded-2xl p-1 min-w-[230px] max-w-[280px]",
                }}
              >
                <DropdownTrigger>
                  <button
                    type="button"
                    className={SidebarItemStyles({
                      isActive: isPosActive,
                      compact: isCompact,
                    })}
                    aria-label="Punto de Venta"
                    title={isCompact ? "Punto de Venta" : undefined}
                  >
                    {/* Active accent indicator bar */}
                    {isPosActive && (
                      <span
                        className={`absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full transition-all ${
                          isCompact ? "left-0.5" : "left-0"
                        }`}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isPosActive
                          ? "text-primary"
                          : "text-default-500 group-hover:text-foreground"
                      }`}
                    >
                      <LuStore className="w-5 h-5" />
                    </div>

                    {/* Title & Chevron (hidden in compact mode) */}
                    {!isCompact && (
                      <div className="flex items-center justify-between flex-1 min-w-0 pr-0.5 text-left">
                        <span className="text-sm font-semibold tracking-tight truncate leading-tight text-foreground group-hover:text-primary transition-colors">
                          Punto de Venta
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary">
                            {effectiveShops.length}
                          </span>
                          <LuChevronDown className="w-3.5 h-3.5 text-default-400 group-hover:text-foreground transition-transform" />
                        </div>
                      </div>
                    )}
                  </button>
                </DropdownTrigger>

                <DropdownMenu
                  aria-label="Seleccionar Tienda para Punto de Venta"
                  variant="flat"
                  className="p-1 max-h-[280px] overflow-y-auto no-scrollbar scrollbar-none"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                  onAction={(key) => {
                    const selectedShop = effectiveShops.find(
                      (s) =>
                        String(s.slug) === String(key) || String(s.id) === String(key)
                    );
                    if (selectedShop?.slug) {
                      navigate(`/tienda/${selectedShop.slug}`);
                    } else if (key) {
                      navigate(`/tienda/${key}`);
                    }
                    if (window.innerWidth < 768) {
                      setCollapsed(false);
                    }
                  }}
                >
                  <DropdownSection
                    title={`Tiendas Disponibles (${effectiveShops.length})`}
                    classNames={{
                      heading:
                        "text-[10px] font-bold text-default-400 uppercase tracking-wider px-2 py-1 select-none",
                    }}
                  >
                    {effectiveShops.map((shop) => (
                      <DropdownItem
                        key={shop.slug || String(shop.id)}
                        className="py-2.5 rounded-xl group/shop-item"
                        startContent={
                          <div className="w-8 h-8 rounded-xl bg-default-100 flex items-center justify-center shrink-0 overflow-hidden border border-divider">
                            {shop.front_image ? (
                              <img
                                src={getImageUrl(shop.front_image)}
                                alt={shop.name}
                                className="w-full h-full object-cover"
                                onError={(e: any) => {
                                  e.currentTarget.src = "/favicon.ico";
                                }}
                              />
                            ) : (
                              <LuStore className="w-4 h-4 text-primary" />
                            )}
                          </div>
                        }
                        description={
                          shop.slug ? `@${shop.slug}` : (shop.address || "Terminal POS")
                        }
                      >
                        <span className="font-bold text-xs sm:text-sm text-foreground group-hover/shop-item:text-primary transition-colors">
                          {shop.name}
                        </span>
                      </DropdownItem>
                    ))}
                  </DropdownSection>
                </DropdownMenu>
              </Dropdown>
            </div>
          )}

          {/* 2. Módulos y Secciones Estándar */}
          {links.map((section, idx) => (
            <React.Fragment key={idx}>
              {section.section ? (
                <SidebarMenu title={section.section}>
                  {section.items.map((item, itemIdx) => (
                    <SidebarItem
                      key={itemIdx}
                      title={item.title}
                      icon={item.icon}
                      href={item.href}
                    />
                  ))}
                </SidebarMenu>
              ) : (
                <div className="flex flex-col gap-1">
                  {section.items.map((item, itemIdx) => (
                    <SidebarItem
                      key={itemIdx}
                      title={item.title}
                      icon={item.icon}
                      href={item.href}
                    />
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Sidebar Footer: Desktop Collapse Toggle */}
        <div className={SidebarFooterStyles()}>
          <div
            className={`hidden md:flex items-center ${
              isCompact ? "justify-center" : "justify-between"
            } w-full px-1 py-1`}
          >
            {!isCompact && (
              <div className="flex items-center gap-2 text-default-400 select-none">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
                <span className="text-[11px] font-semibold tracking-tight text-default-500 truncate">
                  Inventarya
                </span>
              </div>
            )}

            <Tooltip
              content={isCompact ? "Expandir menú lateral" : "Colapsar menú lateral"}
              placement="right"
              offset={14}
              delay={80}
              closeDelay={50}
              className="font-medium text-xs px-2.5 py-1"
            >
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="text-default-500 hover:text-foreground hover:bg-default-100 dark:hover:bg-default-100/60 rounded-xl transition-all active:scale-95"
                onPress={toggleCompact}
                aria-label={isCompact ? "Expandir menú lateral" : "Colapsar menú lateral"}
              >
                {isCompact ? (
                  <LuChevronRight className="w-4 h-4" />
                ) : (
                  <LuChevronLeft className="w-4 h-4" />
                )}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </aside>
  );
};
