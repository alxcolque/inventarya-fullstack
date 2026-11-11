import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Input,
  Button,
  Divider,
  Chip,
  Avatar,
  Tooltip,
} from '@nextui-org/react';
import {
  LuMail,
  LuLock,
  LuEye,
  LuEyeOff,
  LuLogIn,
  LuArrowLeft,
  LuPhone,
  LuStore,
  LuBuilding2,
  LuSearch,
  LuArrowRight,
  LuClipboardPaste,
  LuAlertCircle,
} from 'react-icons/lu';
import { toast } from 'sonner';
import { AppLogo, INVENTARYA_LOGO_PATH } from '../../components/branding/AppLogo';
import { useCentralAuthStore } from '../../modules/auth/store/centralAuth.store';
import { useTenantAuthStore } from '../../modules/auth/store/tenantAuth.store';
import { useSettingStore } from '@/modules/tenant/settings/store/settings/settings.store';
import { isCentral, getTenantSlug, getTenantAppUrl } from '../../utils/tenant';
import { clearNativeTenant, saveNativeTenant } from '../../utils/nativeTenant';
import { getImageUrl } from '@/utils';
import { getTenantRootDomain } from '@/utils/apiConfig';
import { searchPublicTenants, resolvePublicTenant } from '@/api/landing/landingApi';
import { IPublicTenant } from '@/interface/landing.interface';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'tenant' ? 'search' : 'central';
  const [mode, setMode] = useState<'central' | 'search'>(initialMode);

  // Estados para la sección de búsqueda y redirección a tenant
  const [tenantQuery, setTenantQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IPublicTenant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  const centralLogin = useCentralAuthStore((state) => state.login);
  const tenantLogin = useTenantAuthStore((state) => state.login);
  const central = isCentral();
  const tenantSlug = getTenantSlug();

  const company = useSettingStore((state) => state.systemData);
  const getSystemData = useSettingStore((state) => state.getSystemData);

  useEffect(() => {
    if (!central) {
      getSystemData();
    }
  }, [central]);

  // Cierre de dropdown de autocompletado al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Búsqueda en tiempo real de tiendas conforme escribe el usuario
  useEffect(() => {
    const trimmed = tenantQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setShowDropdown(false);
      setSearchError(null);
      return;
    }

    if (trimmed.includes('://') || (import.meta.env.DEV && trimmed.includes('.localhost'))) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const tenants = await searchPublicTenants(trimmed);
        setSearchResults(tenants);
        setShowDropdown(tenants.length > 0);
        setSearchError(null);
      } catch (err) {
        console.error('Error buscando tiendas:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [tenantQuery]);

  const brandName = central
    ? 'Inventarya'
    : (company?.business_name && company.business_name !== 'Inventarya Sucursal')
      ? company.business_name
      : (company?.name && company.name !== 'Inventarya Sucursal')
        ? company.name
        : tenantSlug || company?.business_name || 'Mi Tienda';

  const brandLogo = central
    ? INVENTARYA_LOGO_PATH
    : company?.logo && company.logo !== INVENTARYA_LOGO_PATH && company.logo !== '/logo.png' && company.logo !== 'logo.png'
      ? company.logo
      : INVENTARYA_LOGO_PATH;

  const handleSwitchTenant = () => {
    localStorage.removeItem('inventarya_active_tenant');
    clearNativeTenant();
    window.location.reload();
  };

  /**
   * Redirige al tenant seleccionado de manera limpia en Web y Android/Capacitor.
   */
  const handleSelectTenant = (tenant: IPublicTenant) => {
    setIsRedirecting(true);
    const rootDomain = getTenantRootDomain();
    const domain = tenant.primary_domain || `${tenant.slug}.${rootDomain}`;

    localStorage.setItem('inventarya_active_tenant', domain);
    try {
      saveNativeTenant(domain);
    } catch {
      // Ignorar si el string de dominio es inválido
    }

    toast.success(`Accediendo a ${tenant.name}...`, {
      description: 'Redirigiendo al portal de acceso de tu tienda',
    });

    if (Capacitor.isNativePlatform()) {
      setTimeout(() => {
        setIsRedirecting(false);
        window.location.reload();
      }, 350);
      return;
    }

    const targetUrl = getTenantAppUrl({
      slug: tenant.slug,
      domain: tenant.primary_domain,
      data: (tenant as any).data,
    });

    setTimeout(() => {
      window.location.href = targetUrl;
    }, 350);
  };

  /**
   * Resuelve el tenant mediante envío directo (Enter o botón Ingresar).
   */
  const handleSearchOrResolve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const input = tenantQuery.trim();
    if (!input) {
      toast.warning('Ingresa el nombre o URL de tu tienda');
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await resolvePublicTenant(input);
      if (res.found && res.tenant) {
        handleSelectTenant(res.tenant);
      } else {
        setSearchError(res.message || 'No encontramos ninguna tienda activa con los datos ingresados.');
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        'No encontramos ninguna tienda activa con los datos ingresados.';
      setSearchError(message);
      toast.error('Búsqueda de tienda', { description: message });
    } finally {
      setIsSearching(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTenantQuery(text);
        toast.info('Texto pegado desde el portapapeles');
      }
    } catch {
      toast.error('No se pudo acceder al portapapeles del navegador');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);

    try {
      if (!central) {
        // Autenticar en la tienda activa
        await tenantLogin(email, password);
        const tenantStore = useTenantAuthStore.getState();
        if (tenantStore.authStatus === 'auth') {
          if (tenantStore.can('dashboard:access')) {
            navigate('/dashboard');
          } else {
            navigate('/shops');
          }
        }
      } else {
        // Autenticar en Administración Central SaaS
        await centralLogin(email, password);
        const centralStore = useCentralAuthStore.getState();
        if (centralStore.authStatus === 'auth') {
          if (centralStore.can('tenants:create') || centralStore.can('central:access')) {
            navigate('/dashboard');
          } else if (centralStore.can('support:access')) {
            navigate('/support');
          } else {
            navigate('/dashboard');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const isSearchMode = central && mode === 'search';

  return (
    <div className={`w-full ${isSearchMode ? 'max-w-lg' : 'max-w-md'} transition-all duration-300`}>
      <Card className="border border-divider shadow-lg bg-content1 p-2 sm:p-5 rounded-3xl transition-all duration-300">
        <CardHeader className="flex flex-col items-center gap-3 pt-6 pb-2 text-center">
          <div className="p-3.5 rounded-2xl bg-content2 border border-divider/60 shadow-sm flex items-center justify-center">
            <AppLogo
              src={brandLogo}
              alt={brandName}
              className="w-14 h-14 rounded-xl"
            />
          </div>

          <div className="flex flex-col items-center gap-1 w-full">
            <h1 className="text-2xl font-black text-foreground tracking-tight">
              {isSearchMode ? 'Busca tu tienda o punto de venta aquí' : brandName}
            </h1>
            <p className="text-xs text-default-500 font-medium">
              {central ? (
                isSearchMode ? (
                  <span className="inline-flex items-center gap-1 text-primary font-semibold">
                    <LuStore size={13} /> Redirección a Portal de Tienda / Sucursal
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-default-500">
                    <LuBuilding2 size={13} /> Panel Central SaaS
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 text-primary">
                  <LuStore size={13} /> Portal de Tienda / Sucursales
                </span>
              )}
            </p>
          </div>
        </CardHeader>

        <CardBody className="py-4">
          {isSearchMode ? (
            /* ========================================================================= */
            /* SECCIÓN: Busca tu tienda o punto de venta aquí (Redirección a Tenant)     */
            /* ========================================================================= */
            <div className="flex flex-col gap-4">
              <p className="text-xs text-default-500 text-center px-2">
                Ingresa el nombre comercial o enlace de tu tienda para acceder a tu panel de ventas y administración.
              </p>

              <div className="w-full relative" ref={dropdownRef}>
                <form onSubmit={handleSearchOrResolve} className="flex flex-col gap-3">
                  <Input
                    id="search-tenant-input"
                    size="lg"
                    variant="bordered"
                    placeholder={
                      import.meta.env.DEV
                        ? 'Ej: demo, marketsur o http://mitienda.localhost:5173'
                        : 'Ej: marketsur o mitienda.inventarya.com'
                    }
                    value={tenantQuery}
                    onValueChange={setTenantQuery}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    isClearable
                    startContent={<LuSearch className="text-default-400 shrink-0" size={20} />}
                    endContent={
                      <Tooltip content="Pegar desde el portapapeles">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={handlePaste}
                          className="text-default-400 hover:text-primary transition-colors"
                          aria-label="Pegar enlace"
                        >
                          <LuClipboardPaste size={16} />
                        </Button>
                      </Tooltip>
                    }
                    autoFocus
                  />

                  <Button
                    id="search-tenant-submit"
                    type="submit"
                    color="primary"
                    size="lg"
                    className="w-full font-bold shadow-sm transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
                    isLoading={isSearching || isRedirecting}
                    startContent={!isSearching && !isRedirecting && <LuArrowRight className="w-4 h-4" />}
                  >
                    {isRedirecting ? 'Redirigiendo a tu tienda...' : 'Buscar e Ingresar a mi Tienda'}
                  </Button>
                </form>

                {/* Dropdown de autocompletado en vivo */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-content1 border border-divider rounded-2xl shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2.5 bg-content2/60 border-b border-divider flex items-center justify-between text-xs text-default-500 font-bold px-4">
                      <span>Tiendas encontradas ({searchResults.length})</span>
                      <span className="text-[10px] text-default-400 font-normal">Clic para ingresar</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-divider/40">
                      {searchResults.map((tenant) => (
                        <div
                          key={tenant.id}
                          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-default-100/70 transition-colors text-left group cursor-pointer"
                          onClick={() => handleSelectTenant(tenant)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Avatar
                              src={tenant.logo ? getImageUrl(tenant.logo) : '/favicon.ico'}
                              name={tenant.name?.charAt(0) || 'T'}
                              radius="lg"
                              size="sm"
                              className="bg-primary-100 text-primary font-bold shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                                {tenant.name}
                              </span>
                              <span className="text-xs text-default-400 truncate">
                                {import.meta.env.DEV
                                  ? `${tenant.slug}.localhost:5173`
                                  : (tenant.primary_domain || `${tenant.slug}.${getTenantRootDomain()}`)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Chip
                              size="sm"
                              color={tenant.status === 'active' ? 'success' : 'secondary'}
                              variant="flat"
                              className="text-[10px] h-5 capitalize font-semibold"
                            >
                              {tenant.status === 'active' ? 'Activa' : 'Prueba'}
                            </Chip>

                            <Button
                              isIconOnly
                              size="sm"
                              color="primary"
                              variant="flat"
                              className="h-8 w-8 rounded-lg"
                              onPress={() => handleSelectTenant(tenant)}
                              aria-label="Acceder"
                            >
                              <LuLogIn size={15} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Banner de error si no se encuentra la tienda */}
                {searchError && (
                  <div className="mt-3 p-3 rounded-2xl bg-danger-50 dark:bg-danger-900/20 text-danger border border-danger-200 dark:border-danger-800 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <LuAlertCircle className="shrink-0 text-danger" size={16} />
                      <span>{searchError}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      className="text-xs font-semibold"
                      onPress={() => setSearchError(null)}
                    >
                      Cerrar
                    </Button>
                  </div>
                )}
              </div>

              {/* Botón de acceso rápido a tienda de prueba en desarrollo local */}
              {import.meta.env.DEV && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-default-400 pt-1">
                  <span>Tienda de prueba rápida:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTenantQuery('demo');
                      resolvePublicTenant('demo').then((res) => {
                        if (res.found && res.tenant) handleSelectTenant(res.tenant);
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-default-100 text-default-700 hover:text-primary hover:bg-default-200 transition-colors font-mono font-semibold text-xs"
                  >
                    demo
                  </button>
                </div>
              )}

              {/* Opción para retornar a Administración Central */}
              <div className="mt-2 text-center">
                <Button
                  size="sm"
                  variant="light"
                  className="text-default-500 hover:text-primary text-xs font-medium"
                  startContent={<LuBuilding2 size={13} />}
                  onPress={() => {
                    setMode('central');
                    setSearchError(null);
                  }}
                >
                  ← Iniciar sesión como Administrador Central
                </Button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* FORMULARIO DE ACCESO (Central o Tenant según contexto de dominio)          */
            /* ========================================================================= */
            <>
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <Input
                  id="login-email"
                  type="email"
                  label="Correo Electrónico"
                  placeholder="user@mail.com"
                  value={email}
                  onValueChange={setEmail}
                  variant="bordered"
                  isRequired
                  startContent={<LuMail className="text-default-400 w-4 h-4 shrink-0" />}
                  autoComplete="email"
                />

                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  label="Contraseña"
                  placeholder="••••••••"
                  value={password}
                  onValueChange={setPassword}
                  variant="bordered"
                  isRequired
                  startContent={<LuLock className="text-default-400 w-4 h-4 shrink-0" />}
                  endContent={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-default-400 hover:text-default-600 focus:outline-none"
                      aria-label="Alternar visibilidad de contraseña"
                    >
                      {showPassword ? (
                        <LuEyeOff className="w-4 h-4" />
                      ) : (
                        <LuEye className="w-4 h-4" />
                      )}
                    </button>
                  }
                  autoComplete="current-password"
                />

                <Button
                  id="login-submit"
                  type="submit"
                  color="primary"
                  size="lg"
                  className="w-full font-bold mt-2 shadow-sm transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
                  isLoading={loading}
                  startContent={!loading && <LuLogIn className="w-4 h-4" />}
                >
                  {loading ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
                </Button>
              </form>

              {central && (
                <div className="mt-4 text-center">
                  <Button
                    size="sm"
                    variant="light"
                    className="text-default-500 hover:text-primary text-xs font-semibold"
                    startContent={<LuStore size={14} className="text-primary" />}
                    onPress={() => {
                      setMode('search');
                      setSearchError(null);
                    }}
                  >
                    ¿Perteneces a una tienda o sucursal? Haz clic aquí
                  </Button>
                </div>
              )}
            </>
          )}
        </CardBody>

        <Divider className="my-2" />

        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 pb-4 text-xs text-default-500">
          {!central ? (
            <Button
              size="sm"
              variant="light"
              className="text-default-400 hover:text-danger text-xs font-medium"
              onPress={handleSwitchTenant}
            >
              Cambiar tienda / Central
            </Button>
          ) : (
            <Button
              size="sm"
              variant="light"
              className="text-default-500 hover:text-foreground text-xs"
              startContent={<LuArrowLeft className="w-3.5 h-3.5" />}
              onPress={() => navigate('/')}
            >
              Volver al inicio
            </Button>
          )}

          {!central && (company?.phone || company?.email) && (
            <span className="text-[11px] text-default-400 flex items-center gap-1">
              <LuPhone size={12} className="text-primary" />
              {company.phone || company.email}
            </span>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
