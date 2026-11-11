import React from "react";
import { Outlet } from "react-router-dom";

/**
 * ErrorLayout - Generic error boundary layout.
 */
export const ErrorLayout = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">¡Oops! Algo salió mal.</h1>
        <p className="text-gray-600 mb-6">Hemos encontrado un error inesperado.</p>
        <Outlet />
      </div>
    </div>
  );
};
