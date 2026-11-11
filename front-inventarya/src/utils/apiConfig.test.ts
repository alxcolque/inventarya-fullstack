import { describe, it, expect } from 'vitest';
import { validateHttpUrl, validateRequiredString } from './apiConfig';

describe('validateHttpUrl', () => {
  it('accepts valid HTTPS URLs in production', () => {
    const url = validateHttpUrl('VITE_API_URL', 'https://api.inventarya.com/api', true);
    expect(url).toBe('https://api.inventarya.com/api');
  });

  it('accepts valid HTTP URLs in development', () => {
    const url = validateHttpUrl('VITE_API_URL', 'http://localhost:8000/api', false);
    expect(url).toBe('http://localhost:8000/api');
  });

  it('throws an explicit error when required URL is missing or empty', () => {
    expect(() => validateHttpUrl('VITE_API_URL', undefined, false)).toThrow(
      'Configuración requerida ausente: VITE_API_URL'
    );
    expect(() => validateHttpUrl('VITE_API_URL', '   ', false)).toThrow(
      'Configuración requerida ausente: VITE_API_URL'
    );
  });

  it('throws an explicit error when value is not a valid URL', () => {
    expect(() => validateHttpUrl('VITE_API_URL', 'not-a-valid-url', false)).toThrow(
      'Configuración inválida: VITE_API_URL no es una URL válida ("not-a-valid-url").'
    );
  });

  it('throws an explicit error when production URL points to localhost', () => {
    expect(() => validateHttpUrl('VITE_API_URL', 'http://localhost:8000/api', true)).toThrow(
      'Configuración inválida: producción no puede utilizar localhost como VITE_API_URL'
    );
    expect(() => validateHttpUrl('VITE_API_URL', 'https://127.0.0.1:8000/api', true)).toThrow(
      'Configuración inválida: producción no puede utilizar localhost como VITE_API_URL'
    );
    expect(() => validateHttpUrl('VITE_API_URL', 'https://api.localhost/api', true)).toThrow(
      'Configuración inválida: producción no puede utilizar localhost como VITE_API_URL'
    );
  });

  it('throws an explicit error when production URL is not HTTPS', () => {
    expect(() => validateHttpUrl('VITE_API_URL', 'http://api.inventarya.com/api', true)).toThrow(
      'Configuración inválida: producción requiere protocolo HTTPS para VITE_API_URL'
    );
  });
});

describe('validateRequiredString', () => {
  it('accepts non-empty strings', () => {
    expect(validateRequiredString('VITE_TENANT_ROOT_DOMAIN', 'inventarya.com')).toBe('inventarya.com');
  });

  it('throws an explicit error when empty or missing', () => {
    expect(() => validateRequiredString('VITE_TENANT_ROOT_DOMAIN', '')).toThrow(
      'Configuración requerida ausente: VITE_TENANT_ROOT_DOMAIN'
    );
  });
});
