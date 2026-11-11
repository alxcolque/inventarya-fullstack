import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { CameraSession, CameraError, cameraConstraints, cameraStream, getCameraCapabilities,
  releaseCameraVideo, diagnoseCamera, type CameraConstraints } from './cameraService';

export const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODE_93, Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
];


/** The decoder owns its video; use the public DOM MediaStream, never private library fields. */
export function createBarcodeSession(getContainer: () => HTMLElement | null, onScan: (code: string) => void): CameraSession {
  let scanner: Html5Qrcode | null = null;
  let container: HTMLElement | null = null;
  let video: HTMLVideoElement | null = null;
  const session = new CameraSession({
    async open(deviceId) {
      container = getContainer();
      if (!container) throw new CameraError('CAMERA_START_FAILED');
      scanner = new Html5Qrcode(container.id, {
        formatsToSupport: SCAN_FORMATS, verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      const instance = scanner;
      await instance.start(cameraConstraints(deviceId), {
        fps: 20, videoConstraints: cameraConstraints(deviceId),
      }, (code) => {
        if (scanner === instance && session.snapshot.status === 'RUNNING') onScan(code);
      }, () => { /* An undecodable frame is expected, not a camera lifecycle failure. */ });
      video = container.querySelector('video');
      const track = cameraStream(video)?.getVideoTracks()[0];
      if (!track) throw new CameraError('CAMERA_STREAM_INTERRUPTED');
      return track;
    },
    async close() {
      // Capture video before stop/clear removes it, including failed initialization.
      video ??= container?.querySelector('video') ?? null;
      const stream = cameraStream(video);
      let failure: unknown;
      try {
        const track = stream?.getVideoTracks()[0];
        if (track && track.readyState !== 'ended') {
          const torch = getCameraCapabilities(track).torch;
          if (torch === true || Array.isArray(torch) && torch.includes(true)) {
            try { await track.applyConstraints({ advanced: [{ torch: false } as CameraConstraints] }); }
            catch (error) { diagnoseCamera(error); }
          }
        }
        if (scanner?.isScanning) await scanner.stop();
      } catch (error) { failure = error; }
      finally {
        try { scanner?.clear(); } catch (error) { failure ??= error; }
        await releaseCameraVideo(video, stream);
      }
      // If the library cannot stop, keep ownership and refuse another acquisition until cleanup succeeds.
      if (failure) throw failure;
      scanner = null;
      container = null;
      video = null;
    },
  });
  return session;
}
