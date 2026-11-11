import { Capacitor } from '@capacitor/core';

const KEY = 'inventarya-native-tenant';

export const normalizeTenantDomain = (input: string): string | null => {
  if (!input) return null;
  let value = input.trim().toLowerCase();

  // If a full URL is provided (e.g. https://demo.inventarya.com/), extract hostname
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
    try {
      const parsed = new URL(value.startsWith('//') ? `https:${value}` : value);
      if (parsed.username || parsed.password) return null;
      value = parsed.hostname;
    } catch {
      return null;
    }
  }

  // Strip trailing slashes and final DNS dot
  value = value.replace(/\/+$/, '').replace(/\.$/, '');

  if (value.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)) {
    return null;
  }
  return value;
};

export const getNativeTenant = (): string | null =>
  Capacitor.isNativePlatform() ? normalizeTenantDomain(localStorage.getItem(KEY) || '') : null;

export const saveNativeTenant = (domain: string): void => {
  const normalized = normalizeTenantDomain(domain);
  if (!normalized) throw new Error('Introduce el dominio completo de tu negocio.');
  localStorage.setItem(KEY, normalized);
};

export const clearNativeTenant = (): void => localStorage.removeItem(KEY);
