import React from 'react';
import { HeaderPage } from '@/components/ui/HeaderPage';

export const DeveloperPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <HeaderPage 
        title="Desarrollador" 
        subtitle="Herramientas y utilidades para desarrolladores"
      />
      <div className="bg-content1 p-6 rounded-large shadow-sm">
        <p className="text-default-500">Módulo de desarrollador en construcción...</p>
      </div>
    </div>
  );
};
