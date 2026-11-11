import { tenantApi } from '@/api';
import axios from 'axios';

import { getApiBaseUrl } from '@/utils/apiConfig';

export interface DeviceSession {
  tenantDomain: string;
  tenantId: string;
  userId: string;
  authToken: string;
}
// Explicit session snapshot: a late FCM callback must never borrow another login.
const config = (session: DeviceSession) => ({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  headers: { Authorization: `Bearer ${session.authToken}`, 'X-Tenant-Domain': session.tenantDomain },
});
export function registerDeviceToken(token: string, session: DeviceSession, appVersion: string) {
  return axios.post('/device-tokens', { token, platform: 'android', app_version: appVersion }, config(session));
}
export function removeDeviceToken(token: string, session: DeviceSession) {
  return axios.delete('/device-tokens', { ...config(session), data: { token } });
}
export function sendTestPush(title?: string, body?: string) {
  return tenantApi.post('/test/push', { title, body });
}
