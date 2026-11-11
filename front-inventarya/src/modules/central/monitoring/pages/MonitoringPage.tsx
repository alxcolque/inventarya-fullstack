import React from 'react';
import { HeaderPage } from '@/components/ui/HeaderPage';

export const MonitoringPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <HeaderPage 
        title="Monitoreo" 
        subtitle="Visualiza el estado y rendimiento del sistema"
      />
      <div className="bg-content1 p-6 rounded-large shadow-sm">
        <p className="text-default-500">Módulo de monitoreo en construcción...</p>
      </div>
    </div>
  );
};
