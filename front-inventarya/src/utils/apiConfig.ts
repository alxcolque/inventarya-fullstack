/**
 * Configuración estricta de variables de entorno para API e Infraestructura.
 * 
 * Regla:
 * - Configuración correcta -> funciona.
 * - Configuración ausente o errónea -> falla explícitamente con Error descriptivo.
 * - Producción jamás acepta localhost ni sustituye silenciosamente por URLs hardcodeadas.
 */

export function validateHttpUrl(name: string, rawValue: unknown, isProd: boolean): string {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    throw new Error(`Configuración requerida ausente: ${name}`);
  }

  const trimmed = rawValue.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Configuración inválida: ${name} no es una URL válida ("${trimmed}").`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Configuración inválida: ${name} debe utilizar protocolo http o https.`);
  }

  if (isProd) {
    const host = parsed.hostname.toLowerCase();
    const isLocalHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.localhost');

    if (isLocalHost) {
      throw new Error(`Configuración inválida: producción no puede utilizar localhost como ${name} ("${trimmed}").`);
    }

    if (parsed.protocol !== 'https:') {
      throw new Error(`Configuración inválida: producción requiere protocolo HTTPS para ${name} ("${trimmed}").`);
    }
  }

  return trimmed;
}

export function validateRequiredString(name: string, rawValue: unknown): string {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    throw new Error(`Configuración requerida ausente: ${name}`);
  }
  return rawValue.trim();
}

/**
 * Obtiene la URL base de la API (ej. "https://api.inventarya.com/api").
 * Sin barra final.
 */
export function getApiBaseUrl(): string {
  const url = validateHttpUrl('VITE_API_URL', import.meta.env.VITE_API_URL, Boolean(import.meta.env.PROD));
  return url.replace(/\/+$/, '');
}

/**
 * Obtiene la URL pública del backend para almacenamiento y assets (ej. "https://api.inventarya.com/").
 * Con barra final garantizada.
 */
export function getApiPublicUrl(): string {
  const url = validateHttpUrl('VITE_API_PUBLIC_URL', import.meta.env.VITE_API_PUBLIC_URL, Boolean(import.meta.env.PROD));
  return url.replace(/\/+$/, '') + '/';
}

/**
 * Obtiene la URL del sitio principal (ej. "https://inventarya.com").
 * Sin barra final.
 */
export function getSiteUrl(): string {
  const url = validateHttpUrl('VITE_SITE_URL', import.meta.env.VITE_SITE_URL, Boolean(import.meta.env.PROD));
  return url.replace(/\/+$/, '');
}

/**
 * Obtiene la URL de la plataforma central (ej. "https://inventarya.com").
 * Sin barra final.
 */
export function getCentralUrl(): string {
  const url = validateHttpUrl('VITE_CENTRAL_URL', import.meta.env.VITE_CENTRAL_URL, Boolean(import.meta.env.PROD));
  return url.replace(/\/+$/, '');
}

/**
 * Dominio raíz para subdominios de tenants (ej. "inventarya.com").
 */
export function getTenantRootDomain(): string {
  return validateRequiredString('VITE_TENANT_ROOT_DOMAIN', import.meta.env.VITE_TENANT_ROOT_DOMAIN);
}

/**
 * Hostnames centrales permitidos (ej. ["inventarya.com", "www.inventarya.com", "admin.inventarya.com"]).
 */
export function getCentralHostnames(): string[] {
  const raw = validateRequiredString('VITE_CENTRAL_HOSTNAMES', import.meta.env.VITE_CENTRAL_HOSTNAMES);
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}
