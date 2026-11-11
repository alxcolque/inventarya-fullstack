import axios from 'axios';

export type ApiErrorType =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'server'
  | 'network'
  | 'unexpected';

export interface ApiErrorInfo {
  type: ApiErrorType;
  status?: number;
  message: string;
  technicalDetails?: unknown;
}

/**
 * Interpreta y clasifica con precisión un error de petición HTTP / Axios.
 * Responsabilidad exclusiva: clasificar el error e indicar el mensaje real adecuado.
 * NO muestra toasts, no navega ni muta stores.
 */
export function classifyApiError(error: unknown, fallbackMessage?: string): ApiErrorInfo {
  // 1. Error no controlado / no proveniente de Axios (ej. Error de JavaScript)
  if (!axios.isAxiosError(error)) {
    console.error('[API Unhandled Error]:', error);
    return {
      type: 'unexpected',
      message: fallbackMessage || 'Ocurrió un error inesperado en la aplicación.',
      technicalDetails: error,
    };
  }

  // 2. Error de Axios sin respuesta (falla de red, timeout, DNS, CORS, o servidor inaccesible)
  if (!error.response) {
    console.error('[API Network Error]: No se recibió respuesta del servidor.', {
      code: error.code,
      message: error.message,
      url: error.config?.url,
    });
    return {
      type: 'network',
      message: 'No se pudo establecer comunicación con el servidor. Verifica tu conexión a internet o el estado del servicio.',
      technicalDetails: { code: error.code, message: error.message },
    };
  }

  // 3. Error con respuesta HTTP del servidor
  const status = error.response.status;
  const data = error.response.data as Record<string, any> | undefined;
  const backendMessage = typeof data?.message === 'string' && data.message.trim() ? data.message.trim() : undefined;

  // Errores 5xx del servidor
  if (status >= 500) {
    console.error(`[API Server Error ${status}]:`, data || error.message);
    return {
      type: 'server',
      status,
      message: backendMessage || 'El servidor no pudo procesar la solicitud.',
      technicalDetails: data,
    };
  }

  // Error 401: No autenticado / token inválido o expirado
  if (status === 401) {
    return {
      type: 'authentication',
      status,
      message: backendMessage || 'No autorizado o sesión expirada.',
      technicalDetails: data,
    };
  }

  // Error 403: Prohibido / sin permisos
  if (status === 403) {
    return {
      type: 'authorization',
      status,
      message: backendMessage || 'Acceso denegado.',
      technicalDetails: data,
    };
  }

  // Errores 422 o 400: Validación o datos de negocio inválidos
  if (status === 422 || status === 400) {
    return {
      type: 'validation',
      status,
      message: backendMessage || fallbackMessage || 'Los datos proporcionados no son válidos.',
      technicalDetails: data,
    };
  }

  // Otros 4xx (404, 409, etc.)
  return {
    type: 'validation',
    status,
    message: backendMessage || fallbackMessage || `Error en la solicitud (${status}).`,
    technicalDetails: data,
  };
}
