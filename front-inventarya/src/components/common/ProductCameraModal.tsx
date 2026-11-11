import { useCameraLifecycle } from '@/hooks/useScannerLifecycle';
import { createPhotoCameraSession } from '@/services/cameraService';
import React, { useState, useRef, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@nextui-org/react";
import {
  LuCamera,
  LuRefreshCw,
  LuX,
  LuCheck,
  LuRotateCcw,
  LuAlertCircle,
  LuUpload,
} from "react-icons/lu";

export interface ProductCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onFallbackToFileUpload?: () => void;
}

export const ProductCameraModal: React.FC<ProductCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onFallbackToFileUpload,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [session] = useState(() => createPhotoCameraSession(() => videoRef.current));
  const camera = useCameraLifecycle(session, isOpen && !capturedImage, videoElement);
  const videoNode = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoElement(node);
    if (!node) { setCapturedImage(null); setIsFlashing(false); }
  }, []);
  const isLoading = camera.status === 'OPENING' || camera.status === 'STOPPING';
  const errorMessage = camera.error?.message ?? (camera.status === 'IDLE' && !capturedImage ? 'Cámara detenida. Puedes iniciarla nuevamente.' : null);
  const devices = camera.cameras;
  const selectedDeviceId = camera.deviceId;
  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const current = devices.findIndex((device) => device.id === selectedDeviceId);
    void camera.start(devices[(current + 1) % devices.length].id);
  };
  const handleClose = async () => { await camera.stop(); setCapturedImage(null); setIsFlashing(false); onClose(); };

  // Capture frame from video to canvas
  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    // Trigger visual shutter flash
    setIsFlashing(true);


    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setCapturedImage(dataUrl);
    void camera.stop();
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);

  };

  // Confirm photo and send to parent (which will trigger cropper)
  const handleConfirm = async () => {
    if (!capturedImage) return;
    await camera.stop();
    onCapture(capturedImage);
    await handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      placement="center"
      backdrop="blur"
      classNames={{
        base: "bg-background border border-default-200 shadow-2xl rounded-3xl overflow-hidden max-h-[94vh]",
        header: "border-b border-default-100 py-3.5 px-6 shrink-0",
        body: "py-4 px-6 overflow-hidden",
        footer: "border-t border-default-100 py-3 px-6 shrink-0",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <LuCamera size={19} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Tomar Foto del Producto
                  </h3>
                  <p className="text-xs text-default-400 font-normal">
                    {capturedImage
                      ? "Revisa la fotografía antes de encuadrarla"
                      : "Apunta la cámara al producto y presiona capturar"}
                  </p>
                </div>
              </div>

              {devices.length > 1 && !capturedImage && (
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  startContent={<LuRefreshCw size={14} />}
                  onPress={handleSwitchCamera}
                  className="text-xs font-semibold"
                >
                  Cambiar Cámara
                </Button>
              )}
            </ModalHeader>

            <ModalBody className="flex flex-col items-center gap-3">
              {camera.warning && <p role="status" className="text-xs text-warning">{camera.warning.message}</p>}
              {/* Camera Viewport / Preview */}
              <div className="relative w-full h-[280px] sm:h-[360px] md:h-[400px] rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-inner">
                <video ref={videoNode} autoPlay playsInline muted
                  className={"absolute inset-0 w-full h-full object-contain " + (capturedImage || errorMessage || isLoading ? "invisible" : "")} />
                {/* Shutter flash effect */}
                {isFlashing && (
                  <div onAnimationEnd={() => setIsFlashing(false)} className="absolute inset-0 bg-white z-30 pointer-events-none animate-ping opacity-75" />
                )}

                {errorMessage ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm gap-3 z-10">
                    <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center">
                      <LuAlertCircle size={26} />
                    </div>
                    <p className="text-xs sm:text-sm text-default-300 font-medium leading-relaxed">
                      {errorMessage}
                    </p>
                    <Button size="sm" color="primary" isDisabled={isLoading} onPress={() => camera.start()}>
                      Reintentar
                    </Button>
                    {onFallbackToFileUpload && (
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<LuUpload size={14} />}
                        onPress={async () => {
                          await handleClose();
                          onFallbackToFileUpload();
                        }}
                        className="mt-2 text-xs font-semibold"
                      >
                        Subir desde archivos
                      </Button>
                    )}
                  </div>
                ) : capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Foto capturada"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <>
                    {/* Framing guide overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 sm:w-64 sm:h-64 border-2 border-white/60 border-dashed rounded-2xl shadow-sm backdrop-contrast-125" />
                      <div className="absolute bottom-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-white text-[11px] font-medium tracking-wide">
                        Centra el producto en el cuadro
                      </div>
                    </div>

                    {isLoading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white z-20">
                        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Iniciando cámara...</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <Button
                size="sm"
                variant="flat"
                color="default"
                startContent={<LuX size={14} />}
                onPress={handleClose}
                className="font-medium text-xs"
              >
                Cancelar
              </Button>

              <div className="flex items-center gap-2">
                {capturedImage ? (
                  <>
                    <Button
                      size="sm"
                      variant="flat"
                      color="default"
                      startContent={<LuRotateCcw size={14} />}
                      onPress={handleRetake}
                      className="text-xs font-semibold"
                    >
                      Tomar de nuevo
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      startContent={<LuCheck size={15} />}
                      onPress={handleConfirm}
                      className="font-bold text-xs shadow-md"
                    >
                      Usar esta foto
                    </Button>
                  </>
                ) : (
                  <Button
                    size="md"
                    color="primary"
                    startContent={<LuCamera size={18} />}
                    onPress={handleCapture}
                    isDisabled={isLoading || !!errorMessage}
                    className="font-bold text-xs sm:text-sm px-6 shadow-md"
                  >
                    Capturar Foto
                  </Button>
                )}
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
export default ProductCameraModal;
