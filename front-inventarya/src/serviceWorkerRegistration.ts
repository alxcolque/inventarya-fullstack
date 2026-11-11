// Registro del Service Worker para soporte offline en el POS

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.MODE !== 'test') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service Worker registrado con éxito en scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('[SW] Error al registrar el Service Worker:', error);
        });
    });
  }
}
