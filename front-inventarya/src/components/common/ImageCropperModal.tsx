import React, { useState, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Slider,
} from "@nextui-org/react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  LuCrop,
  LuZoomIn,
  LuZoomOut,
  LuRotateCcw,
  LuCheck,
  LuX,
} from "react-icons/lu";
import { getCroppedImg } from "@/utils/image-crop";
import { toast } from "sonner";

export interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onConfirm: (croppedBlob: Blob, croppedBase64: string) => void;
  aspectRatio?: number;
  cropShape?: "rect" | "round";
  title?: string;
  subtitle?: string;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onConfirm,
  aspectRatio = 1, // Cuadrado 1:1 por defecto
  cropShape = "rect",
  title = "Recortar Imagen del Producto",
  subtitle = "Encuadra la imagen en formato cuadrado (1:1)",
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback(
    (_: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleApply = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const { blob, base64 } = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        "image/jpeg",
        0.92
      );
      onConfirm(blob, base64);
      onClose();
    } catch (error) {
      console.error("Error cropping image:", error);
      toast.error("Ocurrió un error al procesar el recorte de la imagen.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      placement="center"
      backdrop="blur"
      hideCloseButton={isProcessing}
      classNames={{
        base: "bg-background border border-default-200 shadow-2xl rounded-3xl overflow-hidden max-h-[92vh]",
        header: "border-b border-default-100 py-3.5 px-6 shrink-0",
        body: "py-4 px-6 overflow-hidden",
        footer: "border-t border-default-100 py-3 px-6 shrink-0",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <LuCrop size={18} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    {title}
                  </h3>
                  <p className="text-xs text-default-400 font-normal">
                    {subtitle}
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="flex flex-col gap-4">
              {/* Visor del Cropper */}
              <div className="relative w-full h-72 sm:h-84 md:h-96 rounded-2xl overflow-hidden bg-black/90 shadow-inner">
                {imageSrc ? (
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspectRatio}
                    cropShape={cropShape}
                    showGrid={true}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-default-400 text-sm">
                    No se cargó ninguna imagen
                  </div>
                )}
              </div>

              {/* Controles de Zoom y Ajuste */}
              <div className="flex flex-col gap-2 p-3 bg-default-50 dark:bg-default-100/40 rounded-2xl border border-default-100">
                <div className="flex items-center justify-between text-xs font-semibold text-default-600">
                  <span className="flex items-center gap-1.5">
                    <LuZoomIn size={14} className="text-primary" /> Nivel de Zoom:{" "}
                    <span className="text-primary font-mono">{zoom.toFixed(1)}x</span>
                  </span>
                  <Button
                    size="sm"
                    variant="light"
                    color="default"
                    startContent={<LuRotateCcw size={13} />}
                    onPress={handleReset}
                    className="h-6 text-[11px] font-medium text-default-400 hover:text-foreground"
                  >
                    Restablecer
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    radius="full"
                    className="h-7 w-7 min-w-7 bg-default-200/60"
                    onPress={() => setZoom((prev) => Math.max(1, +(prev - 0.1).toFixed(2)))}
                    title="Reducir zoom"
                  >
                    <LuZoomOut size={13} />
                  </Button>

                  <Slider
                    size="sm"
                    step={0.02}
                    minValue={1}
                    maxValue={3}
                    aria-label="Ajustar zoom de recorte"
                    value={zoom}
                    onChange={(val) => setZoom(val as number)}
                    className="flex-1"
                    color="primary"
                  />

                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    radius="full"
                    className="h-7 w-7 min-w-7 bg-default-200/60"
                    onPress={() => setZoom((prev) => Math.min(3, +(prev + 0.1).toFixed(2)))}
                    title="Aumentar zoom"
                  >
                    <LuZoomIn size={13} />
                  </Button>
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <span className="text-[11px] text-default-400 hidden sm:inline">
                Arrastra la imagen para posicionarla en el recuadro cuadrado.
              </span>

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<LuX size={14} />}
                  onPress={onClose}
                  isDisabled={isProcessing}
                  className="font-medium text-xs"
                >
                  Cancelar
                </Button>

                <Button
                  size="sm"
                  color="primary"
                  startContent={!isProcessing && <LuCheck size={14} />}
                  onPress={handleApply}
                  isLoading={isProcessing}
                  className="font-bold text-xs shadow-md"
                >
                  Aplicar Recorte
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
