/**
 * Clasificador centralizado y determinista de resultados y errores de sincronización offline.
 * Fase 6B.4A — Endurecimiento de la Cola Offline del POS.
 *
 * Invariante: Una venta offline nunca debe eliminarse de la cola salvo confirmación
 * inequívoca de éxito o idempotencia confirmada (mismo UUID + misma operación).
 */

export type OfflineSyncErrorKind =
  | 'idempotent_success'
  | 'retryable'
  | 'conflict'
  | 'terminal';

export interface ClassifiedOfflineSyncResult {
  kind: OfflineSyncErrorKind;
  code: string;
  message: string;
  isDuplicate?: boolean;
  httpStatus?: number;
}

export function classifyOfflineSyncError(error: any): ClassifiedOfflineSyncResult {
  if (!error) {
    return {
      kind: 'terminal',
      code: 'UNKNOWN_ERROR',
      message: 'Error desconocido durante la sincronización.',
    };
  }

  // 1. Éxito idempotente explícito enviado como objeto o respuesta previa
  if (error.is_duplicate === true || error.code === 'SALE_ALREADY_SYNCED') {
    return {
      kind: 'idempotent_success',
      code: 'SALE_ALREADY_SYNCED',
      message: error.message || 'Venta sincronizada previamente con éxito.',
      isDuplicate: true,
      httpStatus: 200,
    };
  }

  // 2. Errores de Red genuinos y Timeouts con señales reales de Axios/Fetch
  const isGenuineNetwork =
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    error.message === 'Network Error' ||
    ((error.isAxiosError || error.name === 'AxiosError') && Boolean(error.request) && !error.response) ||
    (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout') && Boolean(error.request));

  if (isGenuineNetwork) {
    return {
      kind: 'retryable',
      code: 'NETWORK_ERROR',
      message: 'Fallo de conectividad o tiempo de espera agotado al conectar con el servidor.',
    };
  }

  // Si no hay respuesta HTTP y no tiene señales de red, es un error local de ejecución
  if (!error.response) {
    return {
      kind: 'terminal',
      code: 'UNKNOWN_ERROR',
      message: error.message || 'Error local durante la sincronización.',
    };
  }

  const response = error.response;
  const status = response.status;
  const data = response.data || {};
  const msg: string = data.message || error.message || '';
  const serverCode: string = data.code || '';

  // 3. Status 200 / 201 manejados excepcionalmente (ej. Axios interceptor con datos devueltos como error)
  if (status === 200 || status === 201) {
    if (data.is_duplicate === true || serverCode === 'SALE_ALREADY_SYNCED') {
      return {
        kind: 'idempotent_success',
        code: 'SALE_ALREADY_SYNCED',
        message: msg || 'Venta sincronizada previamente.',
        isDuplicate: true,
        httpStatus: status,
      };
    }
    return {
      kind: 'idempotent_success',
      code: 'SALE_SYNCED',
      message: msg || 'Venta sincronizada.',
      httpStatus: status,
    };
  }

  // 4. Errores transitorios 5xx (502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout)
  if (status === 502 || status === 503 || status === 504) {
    return {
      kind: 'retryable',
      code: `HTTP_${status}`,
      message: `Servidor no disponible temporalmente (${status}). Se reintentará en el próximo ciclo.`,
      httpStatus: status,
    };
  }

  if (status === 500) {
    return {
      kind: 'retryable',
      code: 'INTERNAL_SERVER_ERROR',
      message: msg || 'Error interno del servidor. Se reintentará posteriormente.',
      httpStatus: 500,
    };
  }

  // 5. HTTP 409 — Clasificación Estricta
  if (status === 409) {
    // Si contractualmente el 409 contiene evidencia inequívoca de duplicado idéntico
    if (data.is_duplicate === true || serverCode === 'SALE_ALREADY_SYNCED') {
      return {
        kind: 'idempotent_success',
        code: 'SALE_ALREADY_SYNCED',
        message: msg || 'Venta ya procesada previamente con el mismo identificador.',
        isDuplicate: true,
        httpStatus: 409,
      };
    }

    // Conflicto de UUID con payload diferente o conflicto comercial
    const isPayloadConflict =
      serverCode === 'SALE_IDEMPOTENCY_CONFLICT' ||
      serverCode === 'IDEMPOTENCY_CONFLICT' ||
      msg.toLowerCase().includes('conflicto de idempotencia') ||
      msg.toLowerCase().includes('contenido diferente');

    return {
      kind: 'conflict',
      code: isPayloadConflict ? 'SALE_IDEMPOTENCY_CONFLICT' : (serverCode || 'HTTP_409_CONFLICT'),
      message: msg || 'Conflicto de idempotencia: el UUID ya existe pero el contenido es diferente.',
      httpStatus: 409,
    };
  }

  // 6. Conflicto de Stock (400 o 422 con código o mensaje de stock insuficiente)
  const isStockInsufficient =
    serverCode === 'STOCK_INSUFFICIENT' ||
    msg.toLowerCase().includes('stock insuficiente');

  if (isStockInsufficient) {
    return {
      kind: 'conflict',
      code: 'STOCK_INSUFFICIENT',
      message: msg || 'Stock insuficiente en el inventario central.',
      httpStatus: status,
    };
  }

  // 7. Conflicto de Caja (422 o 400 relacionado con sesión de caja cerrada/no correspondiente)
  const cashStructuredCodes = [
    'CASH_REGISTER_CONFLICT',
    'CASH_REGISTER_CLOSED',
    'CASH_REGISTER_NOT_FOUND',
    'CASH_REGISTER_STORE_MISMATCH',
  ];
  const isCashConflict =
    cashStructuredCodes.includes(serverCode) ||
    msg.toLowerCase().includes('caja original') ||
    msg.toLowerCase().includes('caja está cerrada') ||
    msg.toLowerCase().includes('no existe una caja abierta') ||
    msg.toLowerCase().includes('sesión de caja');

  if (isCashConflict) {
    return {
      kind: 'conflict',
      code: cashStructuredCodes.includes(serverCode) ? serverCode : 'CASH_REGISTER_CONFLICT',
      message: msg || 'Conflicto de caja: la sesión original está cerrada o no corresponde.',
      httpStatus: status,
    };
  }

  // 8. Autenticación / Autorización (401 / 403) — Terminal que requiere intervención del usuario
  if (status === 401) {
    return {
      kind: 'terminal',
      code: 'AUTH_UNAUTHORIZED',
      message: 'Sesión expirada o no autenticada. Requiere iniciar sesión nuevamente.',
      httpStatus: 401,
    };
  }

  if (status === 403) {
    return {
      kind: 'terminal',
      code: 'AUTH_FORBIDDEN',
      message: msg || 'No tiene permisos para registrar ventas en esta sucursal.',
      httpStatus: 403,
    };
  }

  // 9. Errores de validación comercial deterministas (400 / 422)
  if (status === 400 || status === 422) {
    return {
      kind: 'conflict',
      code: serverCode || 'VALIDATION_ERROR',
      message: msg || 'Validación comercial rechazada por el servidor.',
      httpStatus: status,
    };
  }

  // 10. Fallback final para otros códigos
  return {
    kind: 'terminal',
    code: `HTTP_${status}`,
    message: msg || `Petición rechazada con código ${status}.`,
    httpStatus: status,
  };
}

export interface OfflineConflictPresentation {
  title: string;
  description: string;
  severity: 'danger' | 'warning' | 'primary' | 'neutral';
  retryable: boolean;
  action: 'retry' | 'retry_local' | 'refresh_catalog' | 'view_details' | 'contact_admin' | 'switch_store' | 'login' | 'none';
  actionLabel?: string;
  badgeText: string;
}

/**
 * Traduce códigos de error y estados del backend a presentaciones amigables y acciones seguras para el cajero (Fase 6B.4D).
 */
export function getOfflineConflictPresentation(
  errorCode?: string,
  rawMessage?: string,
  serverAccepted?: boolean
): OfflineConflictPresentation {
  // Caso especial: La venta fue aceptada por el servidor pero falló la reconciliación local
  if (serverAccepted || errorCode === 'LOCAL_RECONCILIATION_FAILED') {
    return {
      title: 'Venta registrada en servidor',
      description: 'La venta fue aceptada por el servidor. Pendiente de actualizar los datos en este dispositivo.',
      severity: 'primary',
      retryable: true,
      action: 'retry_local',
      actionLabel: 'Actualizar datos locales',
      badgeText: 'Actualizando localmente',
    };
  }

  const code = errorCode || '';
  const msgLower = (rawMessage || '').toLowerCase();

  // Caso idempotencia confirmada (SALE_ALREADY_SYNCED)
  if (code === 'SALE_ALREADY_SYNCED') {
    return {
      title: 'Venta previamente sincronizada',
      description: 'Esta venta ya fue confirmada y registrada en el servidor con anterioridad.',
      severity: 'primary',
      retryable: false,
      action: 'none',
      actionLabel: 'Sincronizada',
      badgeText: 'Ya sincronizada',
    };
  }

  // 1. Stock insuficiente en servidor (Sección 14)
  if (code === 'STOCK_INSUFFICIENT' || msgLower.includes('stock insuficiente')) {
    return {
      title: 'Stock insuficiente',
      description: 'El stock en el servidor cambió mientras el dispositivo operaba sin conexión.',
      severity: 'danger',
      retryable: false,
      action: 'refresh_catalog',
      actionLabel: 'Actualizar catálogo',
      badgeText: 'Stock insuficiente',
    };
  }

  // 2. Conflictos de Caja (Sección 15)
  if (code === 'CASH_REGISTER_CLOSED' || msgLower.includes('caja está cerrada') || msgLower.includes('caja cerrada')) {
    return {
      title: 'Caja original cerrada',
      description: 'La sesión de caja asignada a esta venta fue cerrada en el servidor. Requiere revisión administrativa; no se modificará automáticamente.',
      severity: 'warning',
      retryable: false,
      action: 'contact_admin',
      actionLabel: 'Consultar administración',
      badgeText: 'Caja cerrada',
    };
  }

  if (code === 'CASH_REGISTER_STORE_MISMATCH' || msgLower.includes('caja no pertenece a la tienda') || msgLower.includes('caja no corresponde')) {
    return {
      title: 'Caja no corresponde a la tienda',
      description: 'La sesión de caja asignada pertenece a otra sucursal. Requiere revisión administrativa.',
      severity: 'danger',
      retryable: false,
      action: 'contact_admin',
      actionLabel: 'Consultar administración',
      badgeText: 'Caja no coincide',
    };
  }

  if (code === 'CASH_REGISTER_NOT_FOUND' || msgLower.includes('caja no encontrada')) {
    return {
      title: 'Caja no encontrada',
      description: 'La sesión de caja asignada a la venta no existe en el servidor.',
      severity: 'danger',
      retryable: false,
      action: 'contact_admin',
      actionLabel: 'Consultar administración',
      badgeText: 'Caja no encontrada',
    };
  }

  if (code === 'CASH_REGISTER_CONFLICT') {
    return {
      title: 'Conflicto de caja',
      description: 'Existe una inconsistencia en la sesión de caja de esta venta.',
      severity: 'warning',
      retryable: false,
      action: 'contact_admin',
      actionLabel: 'Consultar administración',
      badgeText: 'Conflicto de caja',
    };
  }

  // 3. Tienda no coincide (Store Mismatch - Sección 16)
  if (code === 'STORE_MISMATCH' || msgLower.includes('otra sucursal') || msgLower.includes('tienda no coincide') || msgLower.includes('pertenece a otra')) {
    return {
      title: 'Esta venta pertenece a otra sucursal',
      description: 'La venta fue registrada para otra tienda y no puede enviarse desde esta sucursal.',
      severity: 'danger',
      retryable: false,
      action: 'switch_store',
      actionLabel: 'Cambiar de sucursal',
      badgeText: 'Sucursal ajena',
    };
  }

  // 4. Conflicto de Idempotencia / Payload diferente (Sección 17)
  if (
    code === 'SALE_IDEMPOTENCY_CONFLICT' ||
    code === 'IDEMPOTENCY_CONFLICT' ||
    msgLower.includes('idempotencia') ||
    msgLower.includes('contenido diferente')
  ) {
    return {
      title: 'Conflicto de integridad de la venta',
      description: 'El identificador de esta venta ya existe en el servidor pero con datos diferentes.',
      severity: 'danger',
      retryable: false,
      action: 'view_details',
      actionLabel: 'Ver detalle técnico',
      badgeText: 'Conflicto de integridad',
    };
  }

  // 5. Errores temporales de red o timeout (Sección 18)
  if (code === 'NETWORK_ERROR' || code === 'ERR_NETWORK' || msgLower.includes('network') || msgLower.includes('timeout') || msgLower.includes('conectividad')) {
    return {
      title: 'Error de conexión temporal',
      description: 'Fallo de conectividad al intentar comunicar con el servidor.',
      severity: 'warning',
      retryable: true,
      action: 'retry',
      actionLabel: 'Reintentar',
      badgeText: 'Fallo de conexión',
    };
  }

  // 6. Errores de servidor transitorios (500, 502, 503, 504 - Sección 18)
  if (
    code === 'INTERNAL_SERVER_ERROR' ||
    code === 'HTTP_500' ||
    code === 'HTTP_502' ||
    code === 'HTTP_503' ||
    code === 'HTTP_504'
  ) {
    return {
      title: 'Servidor no disponible temporalmente',
      description: 'El servidor tuvo un error temporal. Se reintentará en el próximo ciclo.',
      severity: 'warning',
      retryable: true,
      action: 'retry',
      actionLabel: 'Reintentar',
      badgeText: 'Servidor temporalmente caído',
    };
  }

  // 7. Autenticación / Permisos
  if (code === 'AUTH_UNAUTHORIZED' || code === 'AUTH_FORBIDDEN' || code === 'HTTP_401' || code === 'HTTP_403') {
    return {
      title: 'Sesión no autorizada',
      description: 'Su sesión expiró o no cuenta con permisos para sincronizar en esta sucursal.',
      severity: 'danger',
      retryable: false,
      action: 'login',
      actionLabel: 'Iniciar sesión',
      badgeText: 'Sin autorización',
    };
  }

  // 8. Validación comercial general (400, 422)
  if (code === 'VALIDATION_ERROR' || code === 'HTTP_422' || code === 'HTTP_400') {
    return {
      title: 'Validación comercial rechazada',
      description: rawMessage || 'Los datos de la venta fueron rechazados por las reglas de negocio del servidor.',
      severity: 'danger',
      retryable: false,
      action: 'view_details',
      actionLabel: 'Ver detalle',
      badgeText: 'Validación rechazada',
    };
  }

  // 9. Fallback general
  return {
    title: rawMessage ? 'Atención requerida' : 'Pendiente de sincronización',
    description: rawMessage || 'La venta se encuentra almacenada en este dispositivo.',
    severity: rawMessage ? 'warning' : 'neutral',
    retryable: true,
    action: 'retry',
    actionLabel: 'Reintentar',
    badgeText: rawMessage ? 'Requiere revisión' : 'Pendiente',
  };
}
