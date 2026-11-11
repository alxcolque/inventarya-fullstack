import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  Input,
  Button,
  Card,
  CardBody,
  Chip,
  Avatar,
  Tooltip,
} from "@nextui-org/react";
import {
  LuSearch,
  LuStore,
  LuArrowRight,
  LuLogIn,
  LuClipboardPaste,
  LuAlertCircle,
  LuExternalLink,
  LuSmartphone,
} from "react-icons/lu";
import { searchPublicTenants, resolvePublicTenant } from "@/api/landing/landingApi";
import { IPublicTenant } from "@/interface/landing.interface";
import { getImageUrl } from "@/utils";
import { saveNativeTenant } from "@/utils/nativeTenant";
import { getTenantRootDomain } from "@/utils/apiConfig";
import { toast } from "sonner";

export const TenantSearchSection: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IPublicTenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isNative = Capacitor.isNativePlatform();

  // Debounced search as user types
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setShowDropdown(false);
      setErrorMessage(null);
      return;
    }

    if (trimmed.includes("://") || (import.meta.env.DEV && trimmed.includes(".localhost"))) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const tenants = await searchPublicTenants(trimmed);
        setResults(tenants);
        setShowDropdown(tenants.length > 0);
        setErrorMessage(null);
      } catch (err) {
        console.error("Error searching tenants:", err);
      } finally {
        setIsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const buildTenantUrl = (tenant: IPublicTenant) => {
    const isLocal = import.meta.env.DEV && (
      window.location.hostname.includes("localhost") ||
      window.location.hostname === "127.0.0.1");

    if (isLocal) {
      const port = window.location.port ? `:${window.location.port}` : ":5173";
      return `http://${tenant.slug}.localhost${port}/`;
    }

    const rootDomain = getTenantRootDomain();
    return `https://${tenant.primary_domain || `${tenant.slug}.${rootDomain}`}/`;
  };

  /**
   * Safe same-page redirection (NO new tabs, 100% Capacitor & Android compatible)
   */
  const handleSelectTenant = (tenant: IPublicTenant, mode: "login" | "store" = "login") => {
    setIsRedirecting(true);

    const rootDomain = getTenantRootDomain();
    const domain = tenant.primary_domain || `${tenant.slug}.${rootDomain}`;
    localStorage.setItem("inventarya_active_tenant", domain);

    try {
      saveNativeTenant(domain);
    } catch {
      // Ignored if domain string invalid
    }

    toast.success(`Accediendo a ${tenant.name}...`, {
      description: mode === "store" ? "Cargando portal de tienda" : "Ingresando al sistema",
    });

    // 2. In Capacitor / Android native mode: Stay in the same Webview
    if (isNative) {
      setTimeout(() => {
        setIsRedirecting(false);
        if (mode === "store") {
          navigate(`/tienda/${tenant.slug}`);
        } else {
          navigate("/login");
        }
      }, 300);
      return;
    }

    // 3. In Web browser: Navigate within the SAME tab / window (never window.open)
    if (mode === "store") {
      setTimeout(() => {
        setIsRedirecting(false);
        navigate(`/tienda/${tenant.slug}`);
      }, 300);
      return;
    }

    const targetUrl = buildTenantUrl(tenant);
    setTimeout(() => {
      // Same-window navigation:
      window.location.href = targetUrl;
    }, 350);
  };

  const handleSearchOrResolve = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const input = query.trim();
    if (!input) {
      toast.warning("Ingresa el nombre o URL de tu tienda");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await resolvePublicTenant(input);
      if (res.found && res.tenant) {
        handleSelectTenant(res.tenant, "login");
      } else {
        setErrorMessage(res.message || "No encontramos ninguna tienda activa.");
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        "No encontramos ninguna tienda activa con los datos ingresados.";
      setErrorMessage(message);
      toast.error("Búsqueda de tienda", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setQuery(text);
        toast.info("Texto pegado desde el portapapeles");
      }
    } catch {
      toast.error("No se pudo acceder al portapapeles del navegador");
    }
  };

  return (
    <section
      id="buscar-tienda"
      className="scroll-mt-24 py-6 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full"
      aria-labelledby="search-tenant-title"
    >
      <Card className="from-content1 via-content1/95 to-background shadow-2xl backdrop-blur-xl relative overflow-visible rounded-3xl sm:h-[250px] h-[350px]">
        {/* Glow ambient background effect */}

        <CardBody className="p-4 sm:p-6 flex flex-col items-center text-center gap-2">
          <div className="flex flex-col items-center gap-2">
            <h2 id="search-tenant-title" className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Busca tu tienda o punto de venta aquí
            </h2>
          </div>

          {/* Search Input Container */}
          <div className="w-full max-w-2xl relative" ref={dropdownRef}>
            <form onSubmit={handleSearchOrResolve} className="flex flex-col sm:flex-row gap-2.5">
              <Input
                size="lg"
                variant="bordered"
                radius="sm"
                placeholder={
                  import.meta.env.DEV
                    ? "Ej: marketsur, La Cantera o http://mitienda.localhost:5173"
                    : "Ej: marketsur, La Cantera o mitienda.inventarya.com"
                }
                value={query}
                onValueChange={setQuery}
                onFocus={() => results.length > 0 && setShowDropdown(true)}
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
                classNames={{
                  inputWrapper:
                    "border-default-300 hover:border-primary focus-within:border-primary shadow-sm bg-content2/40 h-14",
                  input: "text-sm",
                }}
              />

              <Button
                type="submit"
                color="primary"
                size="lg"
                radius="sm"
                isLoading={isLoading || isRedirecting}
                endContent={!isLoading && <LuArrowRight size={18} />}
                className="font-bold text-sm h-14 px-8 shadow-md shadow-primary/25 shrink-0"
              >
                {isRedirecting ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>

            {/* Error banner */}
            {errorMessage && (
              <div className="mt-3 p-3 rounded-2xl bg-danger-50 dark:bg-danger-900/20 text-danger border border-danger-200 dark:border-danger-800 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <LuAlertCircle className="shrink-0 text-danger" size={16} />
                  <span>{errorMessage}</span>
                </div>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  className="text-xs font-semibold"
                  onPress={() => setErrorMessage(null)}
                >
                  Cerrar
                </Button>
              </div>
            )}

            {/* Live Autocomplete Results Dropdown */}
            {showDropdown && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-content1 border border-divider rounded-2xl shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-200">
                <div className="p-3 bg-content2/60 border-b border-divider flex items-center justify-between text-xs text-default-500 font-bold px-4">
                  <span>Tiendas encontradas ({results.length})</span>
                  <span className="text-[10px] text-default-400 font-normal">Navegación en la misma página</span>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-divider/40">
                  {results.map((tenant) => (
                    <div
                      key={tenant.id}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-default-100/70 transition-colors text-left group"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectTenant(tenant, "login")}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <Avatar
                          src={tenant.logo ? getImageUrl(tenant.logo) : "/favicon.ico"}
                          name={tenant.name?.charAt(0) || "T"}
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
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <Chip
                          size="sm"
                          color={tenant.status === "active" ? "success" : "secondary"}
                          variant="flat"
                          className="text-[10px] h-5 capitalize font-semibold"
                        >
                          {tenant.status === "active" ? "Activa" : "Prueba"}
                        </Chip>

                        <Tooltip content="Ingresar al sistema">
                          <Button
                            isIconOnly
                            size="sm"
                            color="primary"
                            variant="flat"
                            className="h-8 w-8 rounded-lg"
                            onPress={() => handleSelectTenant(tenant, "login")}
                            aria-label="Acceder"
                          >
                            <LuLogIn size={15} />
                          </Button>
                        </Tooltip>

                        <Tooltip content="Ver catálogo / tienda">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="h-8 w-8 rounded-lg text-default-400 hover:text-foreground"
                            onPress={() => handleSelectTenant(tenant, "store")}
                            aria-label="Ver tienda"
                          >
                            <LuExternalLink size={15} />
                          </Button>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Helper Subtext & Sample Links */}
          {import.meta.env.DEV && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-default-400 pt-1">
              <span>Tienda de prueba rápida:</span>
              <button
                type="button"
                onClick={() => {
                  setQuery("demo");
                  handleSearchOrResolve();
                }}
                className="px-2.5 py-1 rounded-lg bg-default-100 text-default-700 hover:text-primary hover:bg-default-200 transition-colors font-mono font-semibold text-xs"
              >
                demo
              </button>
            </div>
          )}
        </CardBody>

      </Card>
    </section>
  );
};
