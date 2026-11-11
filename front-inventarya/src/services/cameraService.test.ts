import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  native: true, check: vi.fn(), request: vi.fn(), take: vi.fn(), gallery: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mock.native } }));
vi.mock('@capacitor/camera', () => ({
  Camera: { checkPermissions: mock.check, requestPermissions: mock.request,
    takePhoto: mock.take, chooseFromGallery: mock.gallery },
  MediaTypeSelection: { Photo: 'photo' },
  CameraErrorCode: { TakePhotoCancelled: 'cancel-photo', ChooseMediaCancelled: 'cancel-gallery' },
}));
import { ensureCameraPermission, selectNativePhoto } from './cameraService';
beforeEach(() => { vi.clearAllMocks(); mock.native = true; });
describe('camera adapter', () => {
  it('never calls a native plugin on web', async () => {
    mock.native = false;
    expect(await selectNativePhoto('camera')).toBeNull();
    expect(mock.take).not.toHaveBeenCalled();
  });
  it('requests only camera at point of use and reports denial', async () => {
    mock.check.mockResolvedValue({ camera: 'prompt' });
    mock.request.mockResolvedValue({ camera: 'denied' });
    await expect(ensureCameraPermission()).rejects.toMatchObject({ code: 'CAMERA_PERMISSION_DENIED' });
    expect(mock.request).toHaveBeenCalledWith({ permissions: ['camera'] });
    expect(mock.take).not.toHaveBeenCalled();
  });
  it('treats cancellation as a neutral result', async () => {
    mock.check.mockResolvedValue({ camera: 'granted' });
    mock.take.mockRejectedValue({ code: 'cancel-photo' });
    expect(await selectNativePhoto('camera')).toBeNull();
    expect(mock.take).toHaveBeenCalledWith(expect.objectContaining({ saveToGallery: false }));
  });
  it('uses photo picker without requesting storage or camera', async () => {
    mock.gallery.mockResolvedValue({ results: [] });
    expect(await selectNativePhoto('gallery')).toBeNull();
    expect(mock.check).not.toHaveBeenCalled();
    expect(mock.request).not.toHaveBeenCalled();
  });
});
