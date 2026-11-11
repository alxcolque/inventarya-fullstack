import { useScannerLifecycle } from '@/hooks/useScannerLifecycle';
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
  Divider,
} from "@nextui-org/react";
import {
  FaBarcode,
  FaCamera,
  FaCircleCheck,
  FaLightbulb,
  FaRotate,
  FaPlus,
  FaMinus,
  FaFloppyDisk,
  FaKeyboard,
} from "react-icons/fa6";

import { toast } from "sonner";
import { scannerAudio } from "@/utils/scannerAudio";
import { IProductResponse } from "@/interface";

import { CameraFocusIndicator } from '@/components/common/CameraFocusIndicator';

interface BarcodeScannerUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: IProductResponse | null;
  onUpdateBarcode: (productId: number | string, newBarcode: string) => Promise<boolean>;
}

export const BarcodeScannerUpdateModal: React.FC<BarcodeScannerUpdateModalProps> = ({
  isOpen,
  onClose,
  product,
  onUpdateBarcode,
}) => {
  const [capturedBarcode, setCapturedBarcode] = useState<string>("");
  const [manualInput, setManualInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerContainerId = 'product-barcode-modal-scanner';
  const scanner = useScannerLifecycle({ enabled: isOpen && !capturedBarcode, onScan: (code) => {
    const clean = code.trim();
    if (!clean) return;
    void scanner.stop();
    scannerAudio.playSuccess();
    setCapturedBarcode(clean);
    setManualInput(clean);
  } });
  const { cameras, selectedCameraId, isScanning, hasTorch, isTorchOn, zoom, zoomLevel,
    errorMessage, toggleTorch, switchCamera, handleZoom, start: startScanner } = scanner;
  useEffect(() => {
    if (isOpen) { setCapturedBarcode(''); setManualInput(''); }
  }, [isOpen]);

  const handleCameraChange = (id: string) => { if (id && id !== selectedCameraId) void scanner.start(id); };

  // Guardar en Base de Datos
  const handleConfirmUpdate = async () => {
    if (!product) return;
    const finalCode = (capturedBarcode || manualInput).trim();

    if (!finalCode) {
      toast.error("Debes escanear o ingresar un código válido.");
      return;
    }

    setIsSubmitting(true);
    const success = await onUpdateBarcode(product.id, finalCode);
    setIsSubmitting(false);

    if (success) {
      handleClose();
    }
  };

  const handleResetScan = () => { setCapturedBarcode(''); setManualInput(''); };
  const handleClose = async () => { await scanner.stop(); onClose(); };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      placement="center"
      backdrop="blur"
      classNames={{
        base: "bg-background border border-default-200 shadow-2xl rounded-3xl overflow-hidden max-w-lg",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1 pb-2 border-b border-default-100 bg-default-50/50 px-5 pt-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <FaBarcode className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground">
                    Asignar Código de Barras
                  </h3>
                  <p className="text-xs text-default-400 font-normal">
                    {product?.name ? `Producto: ${product.name}` : "Escanea o ingresa el código"}
                  </p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="py-4 px-5 flex flex-col gap-4">
              {/* Información del Producto */}
              {product && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-default-100/60 border border-default-200/60 text-xs">
                  <div className="flex flex-col">
                    <span className="font-bold text-foreground truncate max-w-[240px]">
                      {product.name}
                    </span>
                    <span className="text-default-400 font-mono text-[11px]">
                      SKU: {product.sku || "Sin SKU"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-default-400 uppercase font-semibold">
                      Código Actual
                    </span>
                    <span className="font-mono font-bold text-default-600">
                      {product.barcode || "Sin Código"}
                    </span>
                  </div>
                </div>
              )}

              {/* Si ya se capturó un código, mostrar confirmación */}
              {capturedBarcode ? (
                <div className="flex flex-col items-center justify-center p-5 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl gap-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-3 bg-emerald-500 text-white rounded-full shadow-md">
                    <FaCircleCheck className="text-2xl" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                      Código Detectado
                    </p>
                    <p className="text-2xl font-black font-mono text-foreground mt-0.5 tracking-tight">
                      {capturedBarcode}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="flat"
                    color="default"
                    onPress={handleResetScan}
                    startContent={<FaRotate className="text-xs" />}
                    className="text-xs font-semibold mt-1"
                  >
                    Escanear Otro Código
                  </Button>
                </div>
              ) : (
                /* ÁREA DE ESCÁNER Y ENTRADA RÁPIDA */
                <div className="flex flex-col gap-3">
                  {/* Visor de Cámara */}
                  {!capturedBarcode && (
                    <div className="flex flex-col gap-2">
                      <div onClick={scanner.focusOnTap} className="relative bg-black rounded-2xl overflow-hidden min-h-[260px] sm:min-h-[300px] max-h-[380px] flex items-center justify-center border border-default-200 shadow-inner">
                        <div
                          ref={scanner.containerRef}
                          id={scannerContainerId}
                          className="w-full h-full flex items-center justify-center overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-contain "
                        />
                        <CameraFocusIndicator point={scanner.focusPoint} onDone={scanner.clearFocus} />
                        {/* Línea guía de escaneo láser */}
                        {isScanning && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="w-4/5 h-36 border-2 border-emerald-400/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                              <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                              <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                              <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                              <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
                              <div className="absolute inset-x-0 bottom-1.5 text-center">
                                <span className="text-[10px] text-white/80 font-mono tracking-wider bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                  Centra el código y acerca o aleja el teléfono para enfocar
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {errorMessage && (
                          <div className="absolute inset-0 bg-background/95 p-4 flex flex-col items-center justify-center text-center gap-2 z-10">
                            <FaCamera className="text-2xl text-danger" />
                            <p className="text-xs text-foreground font-semibold">{errorMessage}</p>
                            <Button
                              size="sm"
                              color="primary"
                              variant="flat"
                              onPress={() => startScanner(selectedCameraId || undefined)}
                            >
                              Reintentar
                            </Button>
                          </div>
                        )}
                      </div>

                      {scanner.warning && <p role="status" className="text-xs text-warning">{scanner.warning.message}</p>}
                      {/* Herramientas de la cámara: Selector, Linterna y Zoom */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {cameras.length > 1 && (
                          <div className="flex items-center gap-1.5">
                            <Select
                              size="sm"
                              aria-label="Cámara"
                              selectedKeys={selectedCameraId ? [selectedCameraId] : []}
                              onChange={(e) => handleCameraChange(e.target.value)}
                              className="w-36"
                              classNames={{
                                trigger: "h-8 min-h-8 bg-default-100 border border-default-200 text-xs",
                              }}
                            >
                              {cameras.map((c, i) => (
                                <SelectItem key={c.id} textValue={c.label || `Cámara ${i + 1}`}>
                                  {c.label || `Cámara ${i + 1}`}
                                </SelectItem>
                              ))}
                            </Select>

                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              radius="lg"
                              onPress={switchCamera}
                              className="h-8 w-8 min-w-8"
                              title="Cambiar cámara"
                            >
                              <FaRotate className="text-xs" />
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          {hasTorch && (
                            <Button
                              size="sm"
                              variant={isTorchOn ? "solid" : "flat"}
                              color={isTorchOn ? "warning" : "default"}
                              radius="lg"
                              onPress={toggleTorch}
                              startContent={<FaLightbulb className="text-xs" />}
                              className="h-8 text-xs font-medium"
                            >
                              {isTorchOn ? "Apagar" : "Luz"}
                            </Button>
                          )}

                          {/* Zoom */}
                          {zoom && zoomLevel !== undefined && <div className="flex items-center bg-default-100 border border-default-200 rounded-lg p-0.5 h-8">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              radius="sm"
                              onPress={() => handleZoom(-zoom.step || -0.1)}
                              isDisabled={scanner.isBusy || zoomLevel <= zoom.min}
                              className="h-7 w-7 min-w-7 text-xs"
                              title="Alejar"
                            >
                              <FaMinus />
                            </Button>
                            <span className="text-[11px] font-mono font-bold px-1.5 min-w-[28px] text-center text-default-600">
                              {zoomLevel}x
                            </span>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              radius="sm"
                              onPress={() => handleZoom(zoom.step || 0.1)}
                              isDisabled={scanner.isBusy || zoomLevel >= zoom.max}
                              className="h-7 w-7 min-w-7 text-xs"
                              title="Acercar"
                            >
                              <FaPlus />
                            </Button>
                          </div>}
                        </div>
                      </div>
                    </div>
                  )}

                  <Divider className="my-1" />

                  {/* Input Manual o Pistola de Código de Barras */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-default-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FaKeyboard className="text-default-400" />
                      Escanear con Pistola USB o Escribir Manualmente:
                    </label>
                    <Input
                      ref={inputRef}
                      size="sm"
                      placeholder="Ej: 7751234567890 o 00N1"
                      value={manualInput}
                      onValueChange={(val) => {
                        setManualInput(val);
                        setCapturedBarcode("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleConfirmUpdate();
                        }
                      }}
                      startContent={<FaBarcode className="text-default-400" />}
                      className="font-mono font-semibold"
                    />
                  </div>
                </div>
              )}
            </ModalBody>

            <ModalFooter className="px-5 py-3.5 border-t border-default-100 bg-default-50/50 flex justify-between items-center">
              <Button
                size="sm"
                variant="light"
                color="default"
                onPress={handleClose}
                className="font-semibold text-xs"
              >
                Cancelar
              </Button>

              <Button
                size="sm"
                color="primary"
                variant="solid"
                onPress={handleConfirmUpdate}
                isLoading={isSubmitting}
                isDisabled={!capturedBarcode && !manualInput.trim()}
                startContent={!isSubmitting && <FaFloppyDisk className="text-xs" />}
                className="font-bold text-xs px-5 shadow-sm"
              >
                Asignar Código
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
