/**
 * Multi-tenant domain and port detection utility.
 *
 * Rules:
 *  - CENTRAL (Superadmin / SaaS management):
 *      - Local:       localhost:5173, admin.localhost, 127.0.0.1:5173
 *      - Production:  configured with VITE_CENTRAL_HOSTNAMES; defaults to Inventarya.
 *
 *  - TENANT (Business panel / Inventario):
 *      - Local (Port):       localhost:5174, localhost:5175, etc.
 *      - Local (Subdomain):  inventario1.localhost:5173
 *      - Production:         the full hostname is sent to the backend. The
 *                            browser never guesses a slug for custom domains.
 */

import { Capacitor } from '@capacitor/core';

const parseHostnames = (value: string | undefined): string[] =>
  (value || '')
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

const LOCAL_CENTRAL_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  'admin.localhost',
];

import { getCentralHostnames, getTenantRootDomain, getCentralUrl as getConfiguredCentralUrl } from '@/utils/apiConfig';

const configuredCentralHostnames = parseHostnames(import.meta.env.VITE_CENTRAL_HOSTNAMES);

const CENTRAL_HOSTNAMES = Array.from(new Set([
  ...(import.meta.env.DEV ? LOCAL_CENTRAL_HOSTNAMES : []),
  ...(configuredCentralHostnames.length > 0
    ? configuredCentralHostnames
    : getCentralHostnames()),
]));

const TENANT_ROOT_DOMAIN = getTenantRootDomain();
const CENTRAL_URL = getConfiguredCentralUrl();

const CENTRAL_SUBDOMAINS = ['admin', 'www'];

export const getEffectiveHostname = (): string => {
  if (typeof window === 'undefined') return 'inventarya.com';
  const hostname = window.location.hostname.toLowerCase().replace(/\.$/, '');
  if (Capacitor.isNativePlatform() && (!hostname || hostname === 'localhost' || hostname === '127.0.0.1')) {
    return 'inventarya.com';
  }
  return hostname;
};

/**
 * Get the tenant request identifier.
 * Functions identically in web and Capacitor Android:
 * - Base host inventarya.com operates Central SaaS by default.
 * - Subdomains, explicit tenant paths, or active stored tenants operate as Tenant.
 */
export const getTenantSlug = (): string | null => {
  const hostname = getEffectiveHostname();
  const port = typeof window !== 'undefined' ? window.location.port : '';

  // Explicit query parameters (e.g. ?tenant=alicia)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const tenantParam = params.get('tenant');
    if (tenantParam) {
      localStorage.setItem('inventarya_active_tenant', tenantParam);
      if (port) {
        localStorage.setItem(`inventarya_tenant_port_${port}`, tenantParam);
      }
      return tenantParam;
    }
  }

  // Check stored active tenant
  const storedTenant = typeof window !== 'undefined'
    ? (localStorage.getItem('inventarya_active_tenant') ??
       localStorage.getItem('inventarya-native-tenant') ??
       localStorage.getItem('stockly_active_tenant'))
    : null;

  // Check if current URL pathname is explicitly a tenant operation
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isTenantExplicit =
    pathname.startsWith('/pos') ||
    pathname.startsWith('/tienda') ||
    pathname.startsWith('/inventories') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/categories') ||
    pathname.startsWith('/locations') ||
    pathname.startsWith('/brands') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/suppliers') ||
    pathname.startsWith('/sales') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/shops') ||
    pathname.startsWith('/stores') ||
    pathname.startsWith('/activate-account');

  // On native Capacitor, respect active stored tenant
  if (Capacitor.isNativePlatform()) {
    return storedTenant || null;
  }

  if (CENTRAL_HOSTNAMES.includes(hostname)) {
    if (isTenantExplicit && storedTenant) {
      return storedTenant;
    }
    return null;
  }

  if (!import.meta.env.DEV) {
    // This may be a managed subdomain or a custom hostname.
    return hostname;
  }

  // Local subdomains (e.g. inventario1.localhost).
  const parts = hostname.split('.');
  if (parts.length > 1) {
    const sub = parts[0];
    if (CENTRAL_SUBDOMAINS.includes(sub)) {
      return null;
    }
    return sub; // e.g. 'inventario1', 'tienda'
  }

  // Localhost / 127.0.0.1 port-based resolution.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (isTenantExplicit) {
      return storedTenant || 'alicia';
    }

    if (!port || port === '5173') {
      return null;
    }

    const stored = localStorage.getItem(`inventarya_tenant_port_${port}`) ?? localStorage.getItem(`stockly_tenant_port_${port}`);
    if (stored) {
      return stored;
    }

    const portNum = parseInt(port, 10);
    if (portNum >= 5174) {
      return `inventario${portNum - 5173}`;
    }
  }

  return null;
};

export const getTenantRequestHeader = (): { name: 'X-Tenant' | 'X-Tenant-Domain'; value: string } | null => {
  const identifier = getTenantSlug();
  if (!identifier) return null;

  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) {
    return { name: 'X-Tenant', value: identifier };
  }

  const fullDomain = identifier.includes('.')
    ? identifier
    : `${identifier}.${TENANT_ROOT_DOMAIN}`;

  return { name: 'X-Tenant-Domain', value: fullDomain };
};

export const isCentral = (): boolean => {
  return getTenantSlug() === null;
};

export const isTenant = (): boolean => {
  return getTenantSlug() !== null;
};

/**
 * Generate the access URL for a tenant in local development or production.
 */
export const getTenantAppUrl = (tenant: {
  slug: string;
  domain?: string | null;
  data?: { local_port?: number | string } | null;
}): string => {
  const isLocal = import.meta.env.DEV && (window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1');

  if (isLocal) {
    // Check if tenant has a dedicated local port in its metadata (e.g. 5174)
    const localPort = tenant.data?.local_port;
    if (localPort) {
      return `http://localhost:${localPort}/login?tenant=${tenant.slug}`;
    }
    // Subdomain on current local port (e.g. http://inventario1.localhost:5173/login)
    const currentPort = window.location.port ? `:${window.location.port}` : ':5173';
    return `http://${tenant.slug}.localhost${currentPort}/login`;
  }

  // Production
  const primaryDomain = tenant.domain || `${tenant.slug}.${TENANT_ROOT_DOMAIN}`;
  return `https://${primaryDomain}/login`;
};

/**
 * Generate the URL to return to the central SaaS platform.
 */
export const getCentralUrl = (): string => {
  const isLocal = import.meta.env.DEV && (window.location.hostname.includes('localhost') || window.location.hostname === '127.0.0.1');

  if (isLocal) {
    const port = window.location.port ? `:${window.location.port}` : ':5173';
    return `http://localhost${port}/`;
  }

  return `${CENTRAL_URL}/`;
};
