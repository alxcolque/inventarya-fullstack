import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import { useEffect } from "react";
import { setPushNavigator } from "@/services/pushNotificationService";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Seo } from "@/components/seo/Seo";

const INDEXABLE_PUBLIC_PATHS = new Set(["/", "/landing", "/terms", "/policy"]);

const RouteIndexingPolicy = () => {
  const { pathname } = useLocation();

  if (INDEXABLE_PUBLIC_PATHS.has(pathname)) return null;

  return (
    <Seo
      title="Acceso a la plataforma"
      description="Área funcional de la plataforma Inventarya."
      path={pathname}
      noIndex
    />
  );
};

export default function App(){
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const authenticated = useTenantAuthStore((state) => state.authStatus === 'auth');
  useEffect(() => {
    setPushNavigator(authenticated && pathname !== '/login' ? (route) => { void navigate(route); } : null);
    return () => setPushNavigator(null);
  }, [navigate, authenticated, pathname]);
  return (
    <>
      <RouteIndexingPolicy />
      <main>
        <Outlet/>
      </main>
    </>
  )
}
