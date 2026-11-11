import React from 'react';
import { Outlet } from 'react-router-dom';
import { FooterLayout } from '../footer/footer-layout';
import { NavbarComponent } from '@/components/navbar/navbar-component';

/**
 * PublicLayout - Layout for public-facing tenant store pages.
 * No authentication required.
 * Domain: tienda.localhost (tenant public store)
 */
export const PublicLayout = ({ children }: { children?: React.ReactNode }) => {
  return (
    <section className="flex flex-col min-h-screen">
      <NavbarComponent />
      <main className="flex-1">
        {children ?? <Outlet />}
      </main>
      <FooterLayout />
    </section>
  );
};
