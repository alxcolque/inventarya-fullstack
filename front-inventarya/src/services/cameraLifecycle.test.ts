import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraSession, cameraConstraints, cameraError, releaseCameraVideo, createPhotoCameraSession,
  type CameraCapabilities, type CameraSettings, type CameraConstraints } from './cameraService';
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

function track(capabilities: CameraCapabilities = {}, settings: CameraSettings = {}) {
  const events = new EventTarget();
  let ended = false;
  const current = { deviceId: 'rear', ...settings };
  return {
    get readyState() { return ended ? 'ended' : 'live'; },
    getCapabilities: () => capabilities, getSettings: () => ({ ...current }),
    applyConstraints: vi.fn(async (value: MediaTrackConstraints) => { Object.assign(current, value.advanced?.[0]); }),
    stop: vi.fn(() => { ended = true; }),
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  } as unknown as MediaStreamTrack;
}
const sessions: CameraSession[] = [];
function session(open: () => Promise<MediaStreamTrack>, close: () => Promise<void>) {
  const value = new CameraSession({ open, close });
  sessions.push(value);
  return value;
}
beforeEach(() => {
  vi.stubGlobal('navigator', { mediaDevices: {
    enumerateDevices: vi.fn(async () => [{ kind: 'videoinput', deviceId: 'rear', label: 'Back' }]),
    getSupportedConstraints: () => ({ pointsOfInterest: true }),
  } });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  for (const value of sessions.splice(0)) await value.stop();
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});
describe('serialized camera lifecycle', () => {
  it('defaults to environment and only explicit selection uses deviceId', () => {
    expect(cameraConstraints()).toMatchObject({ facingMode: { ideal: 'environment' } });
    expect(cameraConstraints()).not.toHaveProperty('deviceId');
    expect(cameraConstraints('manual')).toMatchObject({ deviceId: { exact: 'manual' } });
  });
  it('waits for closing before reopening with a fresh acquisition', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const open = vi.fn(async () => track());
    const close = vi.fn().mockImplementationOnce(() => gate).mockResolvedValue(undefined);
    const value = session(open, close);
    await value.start();
    const stopping = value.stop();
    const reopening = value.start('front');
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
    expect(open).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([stopping, reopening]);
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith('front');
    expect(value.snapshot.status).toBe('RUNNING');
  });
  it('releases a stream that arrives after close and suppresses stale RUNNING', async () => {
    let resolve!: (value: MediaStreamTrack) => void;
    const cameraTrack = track();
    const open = vi.fn(() => new Promise<MediaStreamTrack>((done) => { resolve = done; }));
    const close = vi.fn(async () => { cameraTrack.stop(); });
    const value = session(open, close);
    const opening = value.start();
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    const closing = value.stop();
    resolve(cameraTrack);
    await Promise.all([opening, closing]);
    expect(cameraTrack.stop).toHaveBeenCalled();
    expect(value.snapshot.status).toBe('IDLE');
    await value.stop(); await value.stop();
    expect(value.snapshot.status).toBe('IDLE');
  });
  it('completes 20 open/close cycles without overlapping tracks', async () => {
    const tracks: MediaStreamTrack[] = [];
    const value = session(async () => {
      expect(tracks.every((item) => item.readyState === 'ended')).toBe(true);
      const next = track(); tracks.push(next); return next;
    }, async () => { tracks.at(-1)?.stop(); });
    for (let i = 0; i < 20; i++) { await value.start(); await value.stop(); }
    expect(tracks).toHaveLength(20);
    expect(tracks.every((item) => item.readyState === 'ended')).toBe(true);
  });
  it('transfers ownership across different components only after release', async () => {
    const firstTrack = track();
    const close = vi.fn(async () => { firstTrack.stop(); });
    const first = session(async () => firstTrack, close);
    const second = session(async () => {
      expect(firstTrack.readyState).toBe('ended');
      return track();
    }, async () => {});
    await first.start(); await second.start();
    expect(first.snapshot.status).toBe('IDLE');
    expect(second.snapshot.status).toBe('RUNNING');
  });
  it('cleans an initialization failure and retries without reusing the old track', async () => {
    const open = vi.fn().mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError')).mockResolvedValue(track());
    const close = vi.fn(async () => {});
    const value = session(open, close);
    await value.start();
    expect(value.snapshot.error?.code).toBe('CAMERA_PERMISSION_DENIED');
    expect(close).toHaveBeenCalled();
    await value.start();
    expect(value.snapshot.status).toBe('RUNNING');
  });
  it('handles interrupted tracks and removes the ended listener during stop', async () => {
    const cameraTrack = track();
    const value = session(async () => cameraTrack, async () => {});
    await value.start();
    cameraTrack.dispatchEvent(new Event('ended'));
    await vi.waitFor(() => expect(value.snapshot.error?.code).toBe('CAMERA_STREAM_INTERRUPTED'));
    await value.stop();
    cameraTrack.dispatchEvent(new Event('ended'));
    expect(value.snapshot.status).toBe('IDLE');
  });
  it('does not invent unsupported zoom or focus', async () => {
    const cameraTrack = track();
    const value = session(async () => cameraTrack, async () => {});
    await value.start();
    expect(await value.setZoom(2)).toBe(false);
    expect(await value.focus({ x: 0.5, y: 0.5 })).toBe(false);
    expect(cameraTrack.applyConstraints).not.toHaveBeenCalled();
  });
  it('applies autofocus, real bounded/stepped zoom, torch and supported focus', async () => {
    const cameraTrack = track({ focusMode: ['continuous'], zoom: { min: 1, max: 4, step: 0.5 }, torch: true }, { zoom: 1, torch: false });
    const value = session(async () => cameraTrack, async () => {});
    await value.start();
    expect(cameraTrack.applyConstraints).toHaveBeenCalledWith({ advanced: [{ focusMode: 'continuous' }] });
    await value.setZoom(2.3);
    expect(value.snapshot.settings.zoom).toBe(2.5);
    await value.setZoom(99);
    expect(value.snapshot.settings.zoom).toBe(4);
    expect(await value.setTorch(true)).toBe(true);
    expect(await value.focus({ x: 0.2, y: 0.7 })).toBe(true);
  });
  it('does not display successful focus if the browser silently ignored the constraint', async () => {
    const cameraTrack = track({ focusMode: ['continuous'] });
    vi.mocked(cameraTrack.applyConstraints).mockResolvedValue(undefined);
    const value = session(async () => cameraTrack, async () => {});
    await value.start();
    expect(await value.focus({ x: 0.5, y: 0.5 })).toBe(false);
  });
  it('classifies important errors instead of claiming every failure is a permission problem', () => {
    for (const [name, code] of [
      ['NotFoundError', 'CAMERA_NOT_FOUND'], ['NotReadableError', 'CAMERA_IN_USE'],
      ['OverconstrainedError', 'CAMERA_CONSTRAINT_FAILED'], ['Error', 'CAMERA_START_FAILED'],
    ]) expect(cameraError(new DOMException('technical cause', name)).code).toBe(code);
  });
  it('releases video/torch/tracks idempotently even if torch fails', async () => {
    const cameraTrack = track({ torch: true });
    vi.mocked(cameraTrack.applyConstraints).mockRejectedValue(new Error('torch failed'));
    const stream = { getTracks: () => [cameraTrack], getVideoTracks: () => [cameraTrack] } as unknown as MediaStream;
    const video = { srcObject: stream, pause: vi.fn() } as unknown as HTMLVideoElement;
    await releaseCameraVideo(video); await releaseCameraVideo(video);
    expect(video.srcObject).toBeNull();
    expect(cameraTrack.readyState).toBe('ended');
    expect(video.pause).toHaveBeenCalled();
  });
  it('photo capture also releases late getUserMedia when closed during permission prompt', async () => {
    let resolve!: (stream: MediaStream) => void;
    const cameraTrack = track();
    const stream = { getTracks: () => [cameraTrack], getVideoTracks: () => [cameraTrack] } as unknown as MediaStream;
    const video = { srcObject: null, play: vi.fn(async () => {}), pause: vi.fn() } as unknown as HTMLVideoElement;
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((done) => { resolve = done; }));
    Object.assign(navigator.mediaDevices, { getUserMedia });
    const value = createPhotoCameraSession(() => video); sessions.push(value);
    const opening = value.start();
    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    const closing = value.stop();
    resolve(stream);
    await Promise.all([opening, closing]);
    expect(video.srcObject).toBeNull();
    expect(cameraTrack.readyState).toBe('ended');
  });
});
