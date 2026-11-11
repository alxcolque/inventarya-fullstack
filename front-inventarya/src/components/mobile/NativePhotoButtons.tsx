import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@nextui-org/react';
import { toast } from 'sonner';
import { selectNativePhoto } from '@/services/cameraService';

export function NativePhotoButtons({ onPhoto }: { onPhoto: (dataUri: string) => void }) {
  const [busy, setBusy] = useState(false);
  if (!Capacitor.isNativePlatform()) return null;
  const choose = async (source: 'camera' | 'gallery') => {
    setBusy(true);
    try {
      const photo = await selectNativePhoto(source);
      if (photo) onPhoto(photo);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir la cámara.');
    } finally { setBusy(false); }
  };
  return <div className="flex gap-2">
    <Button type="button" size="sm" isDisabled={busy} onPress={() => void choose('camera')}>Tomar foto</Button>
    <Button type="button" size="sm" isDisabled={busy} onPress={() => void choose('gallery')}>Galería</Button>
  </div>;
}
