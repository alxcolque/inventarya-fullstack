import React from 'react';
import { Outlet } from 'react-router-dom';
import { NavbarComponent } from '@/components/navbar/navbar-component';
import { FooterLayout } from '../footer/footer-layout';

/**
 * AuthLayout - Shared login layout for both Central and Tenant systems.
 * Includes universal NavbarComponent with dark/light mode and FooterLayout.
 */
export const AuthLayout: React.FC = () => {
  return (
    <section className="flex flex-col min-h-screen bg-background text-foreground">
      <NavbarComponent />
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6">
        <Outlet />
      </main>
      <FooterLayout />
    </section>
  );
};
