import { build, loadEnv } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Cargar variables de producción. Si existe un archivo .env.android explícito, sus valores toman prioridad.
const prodEnv = loadEnv('production', process.cwd(), 'VITE_');
const hasAndroidEnvFile =
  fs.existsSync(path.resolve(process.cwd(), '.env.android')) ||
  fs.existsSync(path.resolve(process.cwd(), '.env.android.local'));

const androidEnv = hasAndroidEnvFile ? loadEnv('android', process.cwd(), 'VITE_') : {};

const env = {
  ...prodEnv,
  ...androidEnv,
  ...process.env,
};

const requiredKeys = [
  'VITE_API_URL',
  'VITE_API_PUBLIC_URL',
  'VITE_SITE_URL',
  'VITE_CENTRAL_URL',
  'VITE_TENANT_ROOT_DOMAIN',
];

for (const key of requiredKeys) {
  const value = (env[key] || '').trim();
  if (!value) {
    throw new Error(`Configuración requerida ausente para el build de Android: ${key}`);
  }
  process.env[key] = value;
}

const optionalKeys = [
  'VITE_CENTRAL_HOSTNAMES',
  'VITE_REVERB_APP_KEY',
  'VITE_REVERB_HOST',
  'VITE_REVERB_PORT',
  'VITE_REVERB_SCHEME',
];

for (const key of optionalKeys) {
  if (env[key]) {
    process.env[key] = env[key].trim();
  }
}

// Validaciones estrictas de URL para el build de Android
let apiUrl;
try {
  apiUrl = new URL(process.env.VITE_API_URL);
} catch {
  throw new Error(`Configuración inválida para Android: VITE_API_URL no es una URL válida ("${process.env.VITE_API_URL}").`);
}

if (apiUrl.protocol !== 'https:') {
  throw new Error('Configuración inválida para Android: VITE_API_URL debe utilizar protocolo HTTPS.');
}

const host = apiUrl.hostname.toLowerCase();
if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.localhost')) {
  throw new Error(
    `Configuración inválida: el build de producción de Android no puede utilizar localhost como API ("${process.env.VITE_API_URL}").`
  );
}

// Ejecutar build con las variables estrictas inyectadas
await build({ mode: hasAndroidEnvFile ? 'android' : 'production' });
