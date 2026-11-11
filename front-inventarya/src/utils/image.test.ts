import { describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ native: false }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => platform.native } }));
import { getImageUrl } from './image';
describe('image references on web and Android', () => {
  it('passes CDN/API URLs, data and blob through unchanged', () => {
    for (const input of ['https://cdn.inventarya.com/tenant/demo/products/a.webp',
      'https://api.inventarya.com/storage/a.webp', 'data:image/png;base64,abc', 'blob:example']) {
      expect(getImageUrl(input)).toBe(input);
    }
  });
  it('keeps the local web proxy and handles empty values', () => {
    expect(getImageUrl('tenant/demo/a.webp')).toBe('/storage/tenant/demo/a.webp');
    expect(getImageUrl('/storage/a.webp')).toBe('/storage/a.webp');
    expect(getImageUrl(null)).toBe('');
    expect(getImageUrl(undefined)).toBe('');
  });
  it('resolves legacy paths against the API on native, never prefixes absolute CDN URLs', () => {
    platform.native = true;
    vi.stubEnv('VITE_API_PUBLIC_URL', 'https://api.inventarya.com/');
    expect(getImageUrl('/storage/a.webp')).toBe('https://api.inventarya.com/storage/a.webp');
    expect(getImageUrl('tenant/demo/logo.webp')).toBe('https://api.inventarya.com/storage/tenant/demo/logo.webp');
    expect(getImageUrl('/storage/tenant/demo/logo.webp')).toBe('https://api.inventarya.com/storage/tenant/demo/logo.webp');
    expect(getImageUrl('https://cdn.inventarya.com/a.webp')).toBe('https://cdn.inventarya.com/a.webp');
    expect(getImageUrl('https://cdn.inventarya.com/tenant/demo/logo.webp')).toBe('https://cdn.inventarya.com/tenant/demo/logo.webp');
    expect(getImageUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png');
    // Local static frontend assets must remain local paths, never converted to remote storage
    expect(getImageUrl('/branding/logo-inventarya.png')).toBe('/branding/logo-inventarya.png');
    expect(getImageUrl('branding/logo-inventarya.png')).toBe('/branding/logo-inventarya.png');
    expect(getImageUrl('/favicon.ico')).toBe('/favicon.ico');
    expect(getImageUrl('/favicon.png')).toBe('/favicon.png');
    expect(getImageUrl('/logo.png')).toBe('/logo.png');
    expect(getImageUrl('images/hero.webp')).toBe('/images/hero.webp');
    platform.native = false;
    vi.unstubAllEnvs();
  });
  it('preserves local static branding paths on web', () => {
    expect(getImageUrl('/branding/logo-inventarya.png')).toBe('/branding/logo-inventarya.png');
  });
});
