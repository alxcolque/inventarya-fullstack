import { describe, it, expect, vi } from 'vitest';
import { classifyApiError } from './apiError';
import { AxiosError, AxiosHeaders } from 'axios';

describe('classifyApiError', () => {
  it('returns backend message for 422 validation error', () => {
    const error = new AxiosError(
      'Validation Failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        data: { message: 'El correo electrónico no se encontró' },
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    );

    const result = classifyApiError(error);
    expect(result.type).toBe('validation');
    expect(result.status).toBe(422);
    expect(result.message).toBe('El correo electrónico no se encontró');
  });

  it('returns server error message for 500 status without turning it into credentials error', () => {
    const error = new AxiosError(
      'Internal Server Error',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: { headers: new AxiosHeaders() },
      }
    );

    const result = classifyApiError(error);
    expect(result.type).toBe('server');
    expect(result.status).toBe(500);
    expect(result.message).toBe('El servidor no pudo procesar la solicitud.');
    expect(result.message).not.toContain('Credenciales');
  });

  it('classifies network errors without response without claiming invalid credentials', () => {
    const error = new AxiosError(
      'Network Error',
      'ERR_NETWORK',
      { headers: new AxiosHeaders(), url: 'https://api.inventarya.com/api/auth/login' },
      undefined,
      undefined
    );

    const result = classifyApiError(error);
    expect(result.type).toBe('network');
    expect(result.status).toBeUndefined();
    expect(result.message).toContain('No se pudo establecer comunicación con el servidor');
    expect(result.message).not.toContain('Credenciales');
  });

  it('handles non-Axios unexpected errors properly', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Null pointer exception in client');

    const result = classifyApiError(error);
    expect(result.type).toBe('unexpected');
    expect(result.message).toBe('Ocurrió un error inesperado en la aplicación.');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
