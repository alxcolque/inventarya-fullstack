import { Navigate } from "react-router-dom";

/**
 * PosSelectStore ha sido consolidado dentro de /shops (IndexShops).
 * Cualquier acceso residual redirige automáticamente a /shops.
 */
export const PosSelectStore = () => {
  return <Navigate to="/shops" replace />;
};
