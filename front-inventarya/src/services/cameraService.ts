import { Capacitor } from '@capacitor/core';
import { Camera, CameraErrorCode, MediaTypeSelection } from '@capacitor/camera';

export async function ensureCameraPermission(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  let permission = await Camera.checkPermissions();
  if (permission.camera === 'prompt' || permission.camera === 'prompt-with-rationale') {
    permission = await Camera.requestPermissions({ permissions: ['camera'] });
  }
  if (permission.camera !== 'granted') {
    throw new CameraError('CAMERA_PERMISSION_DENIED');
  }
}

export function isCameraCancellation(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error &&
      [CameraErrorCode.TakePhotoCancelled, CameraErrorCode.ChooseMediaCancelled].includes(error.code as CameraErrorCode)) return true;
  const message = error instanceof Error ? error.message : String(
    typeof error === 'object' && error !== null && 'message' in error ? error.message : error);
  return /cancel|cancell|no image picked|no images selected/i.test(message);
}

/** Return the same base64 contract used by product uploads. Never upload to R2 here. */
export async function selectNativePhoto(source: 'camera' | 'gallery'): Promise<string | null> {
  if (source === 'gallery' || !Capacitor.isNativePlatform()) return readNativePhoto(source);
  return cameraOperation(async () => {
    await activeSession?.release();
    return readNativePhoto(source);
  });
}

async function readNativePhoto(source: 'camera' | 'gallery'): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    if (source === 'camera') await ensureCameraPermission();
    const photo = source === 'camera'
      ? await Camera.takePhoto({ quality: 80, targetWidth: 1600, targetHeight: 1600,
          saveToGallery: false, includeMetadata: false })
      : (await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo,
          allowMultipleSelection: false, includeMetadata: false })).results[0];
    if (!photo?.webPath) return null;
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
      throw new Error('Selecciona una imagen JPG, PNG o WebP.');
    }
    if (blob.size > 2 * 1024 * 1024) throw new Error('La imagen no debe superar 2 MB.');
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    if (isCameraCancellation(error)) return null;
    throw error;
  }
}

export type CameraErrorCodeName = 'CAMERA_PERMISSION_DENIED' | 'CAMERA_NOT_FOUND' | 'CAMERA_IN_USE'
  | 'CAMERA_START_FAILED' | 'CAMERA_CONSTRAINT_FAILED' | 'CAMERA_STREAM_INTERRUPTED';
const messages: Record<CameraErrorCodeName, string> = {
  CAMERA_PERMISSION_DENIED: 'No se concedió permiso para utilizar la cámara.',
  CAMERA_NOT_FOUND: 'No se encontró una cámara disponible.',
  CAMERA_IN_USE: 'La cámara está siendo utilizada por otra aplicación o sesión.',
  CAMERA_START_FAILED: 'No se pudo iniciar la cámara. Intenta abrirla nuevamente.',
  CAMERA_CONSTRAINT_FAILED: 'La cámara no pudo aplicar la configuración solicitada.',
  CAMERA_STREAM_INTERRUPTED: 'La transmisión de la cámara se interrumpió. Vuelve a iniciarla.',
};
export class CameraError extends Error {
  constructor(public readonly code: CameraErrorCodeName, public readonly technicalCause?: unknown) {
    super(messages[code]);
    this.name = code;
  }
}
export function cameraError(error: unknown, fallback: CameraErrorCodeName = 'CAMERA_START_FAILED'): CameraError {
  if (error instanceof CameraError) return error;
  const text = error instanceof Error ? error.name + ' ' + error.message : String(error);
  const code = /NotAllowedError|PermissionDenied|permission denied|permission dismissed/i.test(text) ? 'CAMERA_PERMISSION_DENIED'
    : /NotFoundError|DevicesNotFoundError/i.test(text) ? 'CAMERA_NOT_FOUND'
    : /NotReadableError|TrackStartError|device.*in use/i.test(text) ? 'CAMERA_IN_USE'
    : /OverconstrainedError|ConstraintNotSatisfiedError/i.test(text) ? 'CAMERA_CONSTRAINT_FAILED' : fallback;
  return new CameraError(code, error);
}
export function diagnoseCamera(error: unknown): void {
  if (import.meta.env.DEV) console.warn('[camera]', error);
}

// Image Capture extensions are not yet included in this project's lib.dom typings.
export interface CameraRange { min: number; max: number; step: number }
export interface CameraPoint { x: number; y: number }
export type CameraCapabilities = MediaTrackCapabilities & {
  zoom?: CameraRange; torch?: boolean | boolean[]; focusMode?: string[];
};
export type CameraSettings = MediaTrackSettings & {
  zoom?: number; torch?: boolean; focusMode?: string; pointsOfInterest?: CameraPoint[];
};
export type CameraConstraints = MediaTrackConstraintSet & {
  zoom?: number; torch?: boolean; focusMode?: string; pointsOfInterest?: CameraPoint[];
};
export const cameraConstraints = (deviceId?: string): MediaTrackConstraints => ({
  ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
  width: { ideal: 1280 }, height: { ideal: 720 },
});
export function getCameraCapabilities(track: MediaStreamTrack): CameraCapabilities {
  return track.getCapabilities?.() ?? {};
}
export function cameraStream(video: HTMLVideoElement | null): MediaStream | null {
  const source = video?.srcObject;
  return source && 'getTracks' in source ? source as MediaStream : null;
}
export async function releaseCameraVideo(video: HTMLVideoElement | null, stream = cameraStream(video)): Promise<void> {
  try {
    for (const track of stream?.getVideoTracks() ?? []) {
      const torch = getCameraCapabilities(track).torch;
      if (track.readyState !== 'ended' && (torch === true || Array.isArray(torch) && torch.includes(true))) {
        try { await track.applyConstraints({ advanced: [{ torch: false } as CameraConstraints] }); }
        catch (error) { diagnoseCamera(error); } // Track.stop below remains mandatory if torch OFF fails.
      }
    }
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
    if (video) { video.pause(); video.srcObject = null; }
  }
}
export interface CameraAdapter {
  open(deviceId?: string): Promise<MediaStreamTrack>;
  close(): Promise<void>;
}
export interface CameraSnapshot {
  status: 'IDLE' | 'OPENING' | 'RUNNING' | 'STOPPING' | 'ERROR';
  error: CameraError | null;
  warning: CameraError | null;
  cameras: { id: string; label: string }[];
  deviceId: string;
  capabilities: CameraCapabilities;
  settings: CameraSettings;
}
const initialCameraState = (): CameraSnapshot => ({
  status: 'IDLE', error: null, warning: null, cameras: [], deviceId: '', capabilities: {}, settings: {},
});
let cameraQueue: Promise<void> = Promise.resolve();
let activeSession: CameraSession | null = null;
function cameraOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = cameraQueue.then(operation);
  // Keep the queue usable after failure; the caller is responsible for reporting it.
  cameraQueue = result.then(() => undefined, () => undefined);
  return result;
}

/** One serialized camera owner across scanner, photo modal and native capture. */
export class CameraSession {
  private generation = 0;
  private track: MediaStreamTrack | null = null;
  private subscribers = new Set<(state: CameraSnapshot) => void>();
  private state = initialCameraState();
  constructor(private readonly adapter: CameraAdapter) {}
  get snapshot() { return this.state; }
  subscribe = (listener: (state: CameraSnapshot) => void) => {
    this.subscribers.add(listener);
    listener(this.state);
    return () => { this.subscribers.delete(listener); };
  };
  private publish(update: Partial<CameraSnapshot>) {
    this.state = { ...this.state, ...update };
    this.subscribers.forEach((listener) => listener(this.state));
  }
  private interrupted = () => {
    const error = new CameraError('CAMERA_STREAM_INTERRUPTED');
    const stopped = this.stop();
    const generation = this.generation;
    void stopped.then(() => {
      if (generation === this.generation) this.publish({ status: 'ERROR', error });
    });
  };
  start = (deviceId?: string): Promise<void> => {
    const generation = ++this.generation;
    return cameraOperation(async () => {
      if (generation !== this.generation) return;
      try {
        await activeSession?.release();
        if (generation !== this.generation) return;
        activeSession = this;
        this.publish({ ...initialCameraState(), status: 'OPENING' });
        await ensureCameraPermission();
        if (generation !== this.generation) { await this.release(); return; }
        this.track = await this.adapter.open(deviceId);
        if (generation !== this.generation) { await this.release(); return; }
        this.track.addEventListener('ended', this.interrupted);
        const capabilities = getCameraCapabilities(this.track);
        if (capabilities.focusMode?.includes('continuous')) {
          try { await this.track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as CameraConstraints] }); }
          catch (error) { this.warn(error); } // Optional capability failure is visible; streaming remains usable.
        }
        const settings: CameraSettings = this.track.getSettings();
        let cameras: CameraSnapshot['cameras'] = [];
        try {
          cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
            .map((d) => ({ id: d.deviceId, label: d.label }));
        } catch (error) { this.warn(error); }
        if (generation !== this.generation) { await this.release(); return; }
        if (this.track.readyState === 'ended') throw new CameraError('CAMERA_STREAM_INTERRUPTED');
        this.publish({ status: 'RUNNING', capabilities, settings, deviceId: settings.deviceId ?? deviceId ?? '', cameras });
      } catch (cause) {
        const error = cameraError(cause);
        diagnoseCamera(error);
        try { await this.release(); } catch (cleanupError) { diagnoseCamera(cleanupError); }
        if (generation === this.generation) this.publish({ status: 'ERROR', error });
      }
    });
  };
  stop = (): Promise<void> => {
    ++this.generation; // Immediately invalidates pending acquisition and decode callbacks.
    this.publish({ status: 'STOPPING' });
    return cameraOperation(async () => {
      try { await this.release(); }
      catch (cause) { const error = cameraError(cause); diagnoseCamera(error); this.publish({ status: 'ERROR', error }); }
    });
  };
  /** Called only while holding the shared queue, never from a component. */
  async release(): Promise<void> {
    this.track?.removeEventListener('ended', this.interrupted);
    this.publish({ status: 'STOPPING' });
    try {
      await this.adapter.close();
    } finally {
      this.track?.stop();
      this.track = null;
    }
    if (activeSession === this) activeSession = null;
    this.publish(initialCameraState());
  }
  private warn(cause: unknown) {
    const warning = cameraError(cause, 'CAMERA_CONSTRAINT_FAILED');
    diagnoseCamera(warning);
    this.publish({ warning });
  }
  private control(operation: (track: MediaStreamTrack) => Promise<boolean>): Promise<boolean> {
    const generation = this.generation;
    return cameraOperation(async () => {
      if (generation !== this.generation || this.state.status !== 'RUNNING' || !this.track) return false;
      try {
        const applied = await operation(this.track);
        if (generation !== this.generation) return false;
        this.publish({ settings: this.track.getSettings(), warning: null });
        return applied;
      } catch (error) { this.warn(error); return false; }
    });
  }
  setZoom = (value: number) => this.control(async (track) => {
    const range = getCameraCapabilities(track).zoom;
    if (!range || !Number.isFinite(value)) return false;
    const step = range.step > 0 ? range.step : 0.1;
    const zoom = Math.min(range.max, Math.max(range.min, range.min + Math.round((value - range.min) / step) * step));
    await track.applyConstraints({ advanced: [{ zoom } as CameraConstraints] });
    if (typeof (track.getSettings() as CameraSettings).zoom !== 'number') throw new CameraError('CAMERA_CONSTRAINT_FAILED');
    return true;
  });
  setTorch = (torch: boolean) => this.control(async (track) => {
    const capability = getCameraCapabilities(track).torch;
    if (capability !== true && !(Array.isArray(capability) && capability.includes(torch))) return false;
    await track.applyConstraints({ advanced: [{ torch } as CameraConstraints] });
    return (track.getSettings() as CameraSettings).torch === torch;
  });
  focus = (point: CameraPoint) => this.control(async (track) => {
    const supported = navigator.mediaDevices.getSupportedConstraints() as MediaTrackSupportedConstraints & { pointsOfInterest?: boolean };
    const modes = getCameraCapabilities(track).focusMode;
    const focusMode = modes?.includes('continuous') ? 'continuous' : modes?.includes('single-shot') ? 'single-shot' : null;
    if (!supported.pointsOfInterest || !focusMode) return false;
    await track.applyConstraints({ advanced: [{ focusMode, pointsOfInterest: [point] } as CameraConstraints] });
    const applied = (track.getSettings() as CameraSettings).pointsOfInterest?.[0];
    // A browser may silently ignore an unsupported constraint; never show a false focus result.
    return !!applied && Math.abs(applied.x - point.x) < 0.01 && Math.abs(applied.y - point.y) < 0.01;
  });
}

export function createPhotoCameraSession(getVideo: () => HTMLVideoElement | null): CameraSession {
  let video: HTMLVideoElement | null = null;
  let stream: MediaStream | null = null;
  return new CameraSession({
    async open(deviceId) {
      video = getVideo();
      if (!video) throw new CameraError('CAMERA_START_FAILED');
      if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('CAMERA_NOT_FOUND');
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: cameraConstraints(deviceId) });
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      if (!track) throw new CameraError('CAMERA_NOT_FOUND');
      return track;
    },
    async close() {
      await releaseCameraVideo(video, stream);
      video = null;
      stream = null;
    },
  });
}
