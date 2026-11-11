import React from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutProvider } from '@/context/layout-context';
import { PosNavbar } from './PosNavbar';
import { PosBottomNav } from './PosBottomNav';

/**
 * PosLayout — Layout dedicado para el Punto de Venta (POS).
 * 
 * Características:
 * - Sin sidebar (pantalla completa para venta ágil y táctil).
 * - Navbar superior con logo, tienda y menú Ventas en PC.
 * - Barra de navegación inferior persistente en Tablet y Teléfono (< 1024px).
 * - Perfil con opción "Administrar" habilitada para admin/owner y deshabilitada para staff.
 */
export const PosLayout: React.FC = () => {
  return (
    <LayoutProvider>
      <div className="h-[100dvh] max-h-[100dvh] w-full bg-background text-foreground flex flex-col antialiased overflow-hidden select-text">
        <PosNavbar />
        <main
          id="pos-main"
          className="flex-1 w-full overflow-y-auto overflow-x-hidden px-2 sm:px-3 pt-1 sm:pt-1.5 pb-24 lg:pb-3 min-h-0 flex flex-col touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <Outlet />
        </main>
        <PosBottomNav />
      </div>
    </LayoutProvider>
  );
};
