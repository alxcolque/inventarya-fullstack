import type { CameraPoint } from '@/services/cameraService';

export function CameraFocusIndicator({ point, onDone }: { point: CameraPoint | null; onDone: () => void }) {
  if (!point) return null;
  return <span aria-label="Punto de enfoque solicitado" onAnimationEnd={onDone}
    className="pointer-events-none absolute z-10 h-8 w-8 -translate-x-1/2 -translate-y-1/2 border-2 border-amber-300 rounded animate-ping"
    style={{ left: point.x, top: point.y, animationIterationCount: 1 }} />;
}
