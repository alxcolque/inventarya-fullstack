import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { createBarcodeSession, SCAN_FORMATS } from './barcodeScannerService';
import type { CameraSession } from './cameraService';

const mock = vi.hoisted(() => ({
  instances: [] as { isScanning: boolean; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn>; callback?: (code: string) => void }[],
  failStart: false, failStop: false, track: null as MediaStreamTrack | null,
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('html5-qrcode', async (original) => ({
  ...await original<typeof import('html5-qrcode')>(),
  Html5Qrcode: class MockHtml5Qrcode {
    isScanning = false;
    callback?: (code: string) => void;
    start = vi.fn(async (_target, _config, callback: (code: string) => void) => {
      this.callback = callback;
      if (mock.failStart) throw new DOMException('failed', 'NotReadableError');
      this.isScanning = true;
    });
    stop = vi.fn(async () => {
      if (mock.failStop) throw new Error('stop failed');
      this.isScanning = false;
    });
    clear = vi.fn();
    constructor() {
      mock.instances.push(this);
    }
  },
}));
let session: CameraSession;
let video: HTMLVideoElement;
beforeEach(() => {
  mock.instances = []; mock.failStart = false; mock.failStop = false;
  vi.stubGlobal('navigator', { mediaDevices: {
    enumerateDevices: vi.fn(async () => []), getSupportedConstraints: () => ({}),
  } });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const events = new EventTarget();
  mock.track = {
    getCapabilities: () => ({}), getSettings: () => ({ deviceId: 'actual-rear' }),
    readyState: 'live', stop: vi.fn(),
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
  } as unknown as MediaStreamTrack;
  video = {
    srcObject: { getVideoTracks: () => [mock.track], getTracks: () => [mock.track] },
    pause: vi.fn(),
  } as unknown as HTMLVideoElement;
});
afterEach(async () => {
  mock.failStop = false;
  await session?.stop();
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});
const container = () => ({ id: 'scanner', querySelector: () => video }) as unknown as HTMLElement;
describe('canonical barcode engine', () => {
  it('preserves QR and retail formats', () => {
    for (const format of [Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8, Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E, Html5QrcodeSupportedFormats.CODE_128]) expect(SCAN_FORMATS).toContain(format);
  });
  it('uses environment initially, enumerates without opening another stream and clears idempotently', async () => {
    session = createBarcodeSession(container, vi.fn());
    await session.start();
    expect(session.snapshot.error).toBeNull();
    expect(mock.instances[0].start).toHaveBeenCalledWith(expect.objectContaining({ facingMode: { ideal: 'environment' } }),
      expect.any(Object), expect.any(Function), expect.any(Function));
    expect(session.snapshot.deviceId).toBe('actual-rear');
    await session.stop(); await session.stop();
    expect(mock.instances[0].stop).toHaveBeenCalledTimes(1);
    expect(mock.instances[0].clear).toHaveBeenCalledTimes(1);
    expect(mock.track?.stop).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });
  it('cleans video and scanner when initialization fails', async () => {
    mock.failStart = true;
    session = createBarcodeSession(container, vi.fn());
    await session.start();
    expect(session.snapshot.error?.code).toBe('CAMERA_IN_USE');
    expect(mock.instances[0].clear).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
    expect(mock.track?.stop).toHaveBeenCalled();
  });
  it('force-releases tracks on stop failure and blocks overlap until cleanup succeeds', async () => {
    session = createBarcodeSession(container, vi.fn());
    await session.start();
    mock.failStop = true;
    await session.stop();
    expect(video.srcObject).toBeNull();
    expect(mock.track?.stop).toHaveBeenCalled();
    await session.start('front');
    expect(mock.instances).toHaveLength(1);
    expect(session.snapshot.status).toBe('ERROR');
  });
});
