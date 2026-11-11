import { describe, expect, it } from 'vitest';
import { isSafeInternalRoute } from './safeRoute';
import { normalizeTenantDomain } from './nativeTenant';
import { isCameraCancellation } from '../services/cameraService';

describe('mobile input boundaries', () => {
  it.each(['/sales/123', '/products?search=abc', '/inventory#list'])('accepts internal route %s', (route) => {
    expect(isSafeInternalRoute(route)).toBe(true);
  });
  it.each(['https://evil.test', '//evil.test', '/%2fevil.test', '/%5cevil.test',
    '/%252fevil.test', '/bad%0apath', '/bad path', '/bad%', ' /sales', 'javascript:alert(1)'])(
    'rejects unsafe route %s', (route) => expect(isSafeInternalRoute(route)).toBe(false));
  it('normalizes canonical domains and tolerates full HTTPS URLs', () => {
    expect(normalizeTenantDomain('demo.inventarya.com')).toBe('demo.inventarya.com');
    expect(normalizeTenantDomain(' Demo.Inventarya.com. ')).toBe('demo.inventarya.com');
    expect(normalizeTenantDomain('https://demo.inventarya.com/')).toBe('demo.inventarya.com');
    expect(normalizeTenantDomain('https://demo.inventarya.com')).toBe('demo.inventarya.com');
    expect(normalizeTenantDomain('http://demo.inventarya.com/')).toBe('demo.inventarya.com');
    for (const value of ['demo', 'user@demo.com', 'demo.com:443', 'demo.com/path', 'demo..com', 'https://user:pass@demo.inventarya.com/']) {
      expect(normalizeTenantDomain(value)).toBeNull();
    }
  });
  it('recognizes cancellation without hiding permission errors', () => {
    expect(isCameraCancellation(new Error('User cancelled photos'))).toBe(true);
    expect(isCameraCancellation(new Error('Permission denied'))).toBe(false);
  });
});
