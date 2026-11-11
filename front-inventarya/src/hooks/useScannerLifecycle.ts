import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createBarcodeSession } from '@/services/barcodeScannerService';
import { CameraSession, diagnoseCamera } from '@/services/cameraService';

/** React owns subscriptions/DOM readiness; the service serializes all hardware operations. */
export function useCameraLifecycle(session: CameraSession, enabled: boolean, element: HTMLElement | null) {
  const [snapshot, setSnapshot] = useState(session.snapshot);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => session.subscribe(setSnapshot), [session]);
  useEffect(() => {
    if (enabled && element && !document.hidden) void session.start();
    return () => { void session.stop(); };
  }, [enabled, element, session]);
  useEffect(() => {
    const hide = () => { if (document.hidden) void session.stop(); };
    const pageHide = () => { void session.stop(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', pageHide);
    let disposed = false;
    let removeNative: (() => Promise<void>) | undefined;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => { if (!isActive) void session.stop(); })
        .then((listener) => {
          if (disposed) return listener.remove();
          removeNative = () => listener.remove();
        }).catch(diagnoseCamera);
    }
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', pageHide);
      void removeNative?.().catch(diagnoseCamera);
      void session.stop();
    };
  }, [session]);
  useEffect(() => { if (snapshot.status !== 'RUNNING') setFocusPoint(null); }, [snapshot.status]);
  const focusOnTap = useCallback(async (event: MouseEvent<HTMLElement>) => {
    const host = event.currentTarget;
    const video = host.querySelector('video');
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const rect = video.getBoundingClientRect();
    const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    const x = (event.clientX - rect.left - (rect.width - width) / 2) / width;
    const y = (event.clientY - rect.top - (rect.height - height) / 2) / height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const hostRect = host.getBoundingClientRect();
    const position = { x: event.clientX - hostRect.left, y: event.clientY - hostRect.top };
    setFocusPoint(null);
    if (await session.focus({ x, y })) setFocusPoint(position);
  }, [session]);
  const clearFocus = useCallback(() => setFocusPoint(null), []);
  return { ...snapshot, start: session.start, stop: session.stop, focusOnTap, focusPoint, clearFocus,
    setZoom: session.setZoom, setTorch: session.setTorch };
}

export function useScannerLifecycle({ enabled, onScan }: { enabled: boolean; onScan: (code: string) => void }) {
  const callback = useRef(onScan);
  callback.current = onScan;
  const container = useRef<HTMLDivElement | null>(null);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [session] = useState(() => createBarcodeSession(() => container.current, (code) => callback.current(code)));
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    container.current = node;
    setElement(node);
  }, []);
  const lifecycle = useCameraLifecycle(session, enabled, element);
  const selectedCameraId = lifecycle.deviceId;
  const switchCamera = async () => {
    if (lifecycle.cameras.length < 2) return;
    const index = lifecycle.cameras.findIndex((camera) => camera.id === selectedCameraId);
    await lifecycle.start(lifecycle.cameras[(index + 1) % lifecycle.cameras.length].id);
  };
  const zoom = lifecycle.capabilities.zoom;
  const hasTorch = lifecycle.capabilities.torch === true
    || Array.isArray(lifecycle.capabilities.torch) && lifecycle.capabilities.torch.includes(true);
  return {
    ...lifecycle, containerRef, selectedCameraId, switchCamera,
    isScanning: lifecycle.status === 'RUNNING',
    isBusy: lifecycle.status === 'OPENING' || lifecycle.status === 'STOPPING',
    hasTorch, isTorchOn: lifecycle.settings.torch === true,
    zoom, zoomLevel: lifecycle.settings.zoom,
    toggleTorch: () => lifecycle.setTorch(!lifecycle.settings.torch),
    handleZoom: (delta: number) => lifecycle.setZoom((lifecycle.settings.zoom ?? zoom?.min ?? 1) + delta),
    errorMessage: lifecycle.error?.message ?? (lifecycle.status === 'IDLE' ? 'Cámara detenida. Puedes iniciarla nuevamente.' : null),
  };
}
