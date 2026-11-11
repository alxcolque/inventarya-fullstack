import { describe, expect, it } from 'vitest';
import { isSaleNotification, getNotificationSoundUrl } from './notifications.store';

describe('Notification Sound Routing', () => {
  it('correctly identifies sales notifications and routes to cash.mp3', () => {
    expect(isSaleNotification('Ventas')).toBe(true);
    expect(isSaleNotification('ventas')).toBe(true);
    expect(isSaleNotification('venta')).toBe(true);
    expect(isSaleNotification('sale')).toBe(true);
    expect(isSaleNotification({ title: 'Nueva Venta Registrada' })).toBe(true);
    expect(isSaleNotification({ type: 'sale_created' })).toBe(true);
    expect(isSaleNotification({ message: 'Se ha registrado una venta de 150 Bs.' })).toBe(true);
    expect(isSaleNotification({ data: { type: 'sale' } })).toBe(true);

    expect(getNotificationSoundUrl('Ventas')).toBe('/sounds/cash.mp3');
    expect(getNotificationSoundUrl({ type: 'sale' })).toBe('/sounds/cash.mp3');
    expect(getNotificationSoundUrl({ title: 'Venta #1002' })).toBe('/sounds/cash.mp3');
  });

  it('routes all other notifications to notification.mp3', () => {
    expect(isSaleNotification('Alerta de stock')).toBe(false);
    expect(isSaleNotification({ title: 'Stock Bajo', message: 'Producto con 2 unidades' })).toBe(false);
    expect(isSaleNotification({ type: 'general' })).toBe(false);
    expect(isSaleNotification(undefined)).toBe(false);

    expect(getNotificationSoundUrl('Alerta')).toBe('/sounds/notification.mp3');
    expect(getNotificationSoundUrl({ type: 'general', title: 'Aviso del sistema' })).toBe('/sounds/notification.mp3');
    expect(getNotificationSoundUrl(undefined)).toBe('/sounds/notification.mp3');
  });
});
