import { Capacitor } from '@capacitor/core';
import { getApiPublicUrl } from './apiConfig';

/**
 * Check if a path refers to a local frontend static asset bundled in the app.
 */
export const isLocalStaticAsset = (path: string): boolean => {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return (
    normalized.startsWith('branding/') ||
    normalized.startsWith('images/') ||
    normalized.startsWith('assets/') ||
    normalized.startsWith('sounds/') ||
    normalized.startsWith('favicon') ||
    normalized === 'logo.png' ||
    normalized.startsWith('logo.') ||
    normalized === 'vite.svg'
  );
};

/**
 * Resolve an image reference returned by Laravel or referenced in the frontend.
 * - Absolute URLs (API, Cloudflare R2 / CDN, external) and data/blob previews pass through intact.
 * - Local static assets bundled in the APK/frontend remain local paths.
 * - Backend storage keys (tenant/..., /storage/...) resolve to the HTTPS production API on native Android,
 *   or the local storage route / API on web.
 */
export const getImageUrl = (pathOrUrl?: string | null): string => {
  if (!pathOrUrl) return '';

  const value = pathOrUrl.trim();
  if (!value) return '';

  // 1. Data URLs, blob URLs, and absolute URLs (CDN / R2 / external / HTTPS) pass through unchanged
  if (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//')
  ) {
    return value;
  }

  // 2. Local frontend static assets (packaged in APK / public directory) must never be converted to remote storage
  if (isLocalStaticAsset(value)) {
    return value.startsWith('/') ? value : `/${value}`;
  }

  // 3. Backend storage references
  const clean = value.replace(/^\/?storage\//, '').replace(/^\/+/, '');
  if (!clean) return '';

  if (Capacitor.isNativePlatform()) {
    const base = getApiPublicUrl();
    return new URL('storage/' + clean, base).href;
  }

  return `/storage/${clean}`;
};
