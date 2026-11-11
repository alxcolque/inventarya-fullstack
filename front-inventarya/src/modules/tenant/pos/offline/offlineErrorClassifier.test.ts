import { describe, it, expect } from 'vitest';
import { classifyOfflineSyncError } from './offlineErrorClassifier';

describe('offlineErrorClassifier (Fase 6B.4A - Secciones 7, 32, 37, 41)', () => {
  it('1. network error -> retryable/pending', () => {
    const error = {
      code: 'ERR_NETWORK',
      message: 'Network Error',
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('retryable');
    expect(res.code).toBe('NETWORK_ERROR');
  });

  it('2. timeout -> retryable', () => {
    const error = {
      code: 'ECONNABORTED',
      message: 'timeout of 10000ms exceeded',
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('retryable');
    expect(res.code).toBe('NETWORK_ERROR');
  });

  it('3. 502 / 503 / 504 -> retryable', () => {
    const error503 = {
      response: {
        status: 503,
        data: { message: 'Service Unavailable' },
      },
    };
    const res503 = classifyOfflineSyncError(error503);
    expect(res503.kind).toBe('retryable');
    expect(res503.code).toBe('HTTP_503');

    const error502 = {
      response: {
        status: 502,
        data: { message: 'Bad Gateway' },
      },
    };
    const res502 = classifyOfflineSyncError(error502);
    expect(res502.kind).toBe('retryable');
    expect(res502.code).toBe('HTTP_502');

    const error504 = {
      response: {
        status: 504,
        data: { message: 'Gateway Timeout' },
      },
    };
    const res504 = classifyOfflineSyncError(error504);
    expect(res504.kind).toBe('retryable');
    expect(res504.code).toBe('HTTP_504');
  });

  it('4. same UUID + same operation -> idempotent success (200 with is_duplicate)', () => {
    const response = {
      response: {
        status: 200,
        data: {
          message: 'Venta sincronizada previamente',
          is_duplicate: true,
          code: 'SALE_ALREADY_SYNCED',
        },
      },
    };
    const res = classifyOfflineSyncError(response);
    expect(res.kind).toBe('idempotent_success');
    expect(res.code).toBe('SALE_ALREADY_SYNCED');
    expect(res.isDuplicate).toBe(true);
  });

  it('5. same UUID + different payload -> conflict (409 with SALE_IDEMPOTENCY_CONFLICT)', () => {
    const error = {
      response: {
        status: 409,
        data: {
          message: 'Conflicto de idempotencia: el identificador UUID ya fue utilizado para una venta con contenido diferente.',
          code: 'SALE_IDEMPOTENCY_CONFLICT',
        },
      },
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('conflict');
    expect(res.code).toBe('SALE_IDEMPOTENCY_CONFLICT');
  });

  it('6. generic or unknown 409 must NOT be classified as success', () => {
    const error = {
      response: {
        status: 409,
        data: {
          message: 'Conflicto de concurrencia en inventario',
        },
      },
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('conflict');
    expect(res.kind).not.toBe('idempotent_success');
  });

  it('7. 409 with explicit duplicate evidence -> idempotent success', () => {
    const error = {
      response: {
        status: 409,
        data: {
          message: 'Venta ya procesada con el mismo UUID',
          is_duplicate: true,
          code: 'SALE_ALREADY_SYNCED',
        },
      },
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('idempotent_success');
    expect(res.code).toBe('SALE_ALREADY_SYNCED');
  });

  it('8. stock insufficient -> conflict', () => {
    const error = {
      response: {
        status: 400,
        data: {
          message: 'Stock insuficiente para Producto A. Stock disponible: 1, solicitado: 5.',
          code: 'STOCK_INSUFFICIENT',
        },
      },
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('conflict');
    expect(res.code).toBe('STOCK_INSUFFICIENT');
  });

  it('9. cash register conflict -> conflict', () => {
    const error = {
      response: {
        status: 422,
        data: {
          message: 'La caja original está cerrada o no corresponde a esta tienda. La venta permanece pendiente.',
          code: 'CASH_REGISTER_CONFLICT',
        },
      },
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('conflict');
    expect(res.code).toBe('CASH_REGISTER_CONFLICT');
  });

  it('10. auth errors (401 / 403) -> terminal', () => {
    const error401 = {
      response: {
        status: 401,
        data: { message: 'Unauthenticated.' },
      },
    };
    const res401 = classifyOfflineSyncError(error401);
    expect(res401.kind).toBe('terminal');
    expect(res401.code).toBe('AUTH_UNAUTHORIZED');

    const error403 = {
      response: {
        status: 403,
        data: { message: 'No tienes acceso a esta tienda.' },
      },
    };
    const res403 = classifyOfflineSyncError(error403);
    expect(res403.kind).toBe('terminal');
    expect(res403.code).toBe('AUTH_FORBIDDEN');
  });

  it('11. 500 server error -> retryable', () => {
    const error = {
      response: {
        status: 500,
        data: { message: 'Database connection failed' },
      },
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('retryable');
    expect(res.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('12. generic validation error 422 -> conflict', () => {
    const error = {
      response: {
        status: 422,
        data: { message: 'El campo productos es requerido.' },
      },
    };
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('conflict');
    expect(res.code).toBe('VALIDATION_ERROR');
  });

  it('13. local javascript error (new Error("bug local")) -> NOT network retryable, returns terminal UNKNOWN_ERROR', () => {
    const error = new Error('bug local en componente');
    const res = classifyOfflineSyncError(error);
    expect(res.kind).toBe('terminal');
    expect(res.code).toBe('UNKNOWN_ERROR');
    expect(res.kind).not.toBe('retryable');
  });

  it('14. structured cash error codes (CASH_REGISTER_CLOSED, etc.) -> conflict', () => {
    const errorClosed = {
      response: {
        status: 422,
        data: {
          code: 'CASH_REGISTER_CLOSED',
          message: 'La sesión de caja original está cerrada.',
        },
      },
    };
    const resClosed = classifyOfflineSyncError(errorClosed);
    expect(resClosed.kind).toBe('conflict');
    expect(resClosed.code).toBe('CASH_REGISTER_CLOSED');

    const errorMismatch = {
      response: {
        status: 422,
        data: {
          code: 'CASH_REGISTER_STORE_MISMATCH',
          message: 'La caja pertenece a otra tienda.',
        },
      },
    };
    const resMismatch = classifyOfflineSyncError(errorMismatch);
    expect(resMismatch.kind).toBe('conflict');
    expect(resMismatch.code).toBe('CASH_REGISTER_STORE_MISMATCH');
  });

  it('15. axios network error with request -> retryable NETWORK_ERROR', () => {
    const axiosNetError = {
      isAxiosError: true,
      request: {},
      response: undefined,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    };
    const res = classifyOfflineSyncError(axiosNetError);
    expect(res.kind).toBe('retryable');
    expect(res.code).toBe('NETWORK_ERROR');
  });
});
