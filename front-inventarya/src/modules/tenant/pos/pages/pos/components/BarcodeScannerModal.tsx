import { useScannerLifecycle } from '@/hooks/useScannerLifecycle';
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  Select,
  SelectItem,
  Chip,
} from "@nextui-org/react";
import {
  FaBarcode,
  FaCamera,
  FaCircleCheck,
  FaLightbulb,
  FaRotate,
  FaXmark,
  FaPlus,
  FaMinus,
} from "react-icons/fa6";

import { scannerAudio } from "@/utils/scannerAudio";

import { CameraFocusIndicator } from '@/components/common/CameraFocusIndicator';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const [continuousScan, setContinuousScan] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const lastScanTimeRef = useRef(0);
  const lastScannedCodeRef = useRef<string | null>(null);
  const scannerContainerId = 'pos-html5-qr-reader';
  const scanner = useScannerLifecycle({ enabled: isOpen, onScan: (decodedText) => {
    const cleanText = decodedText.trim();
    if (!cleanText) return;
    const now = Date.now();
    const same = cleanText === lastScannedCodeRef.current;
    if (same && now - lastScanTimeRef.current < 1500 || !same && now - lastScanTimeRef.current < 350) return;
    lastScanTimeRef.current = now;
    lastScannedCodeRef.current = cleanText;
    setLastScannedCode(cleanText);
    scannerAudio.playSuccess();
    onScan(cleanText);
    if (!continuousScan) void handleClose();
  } });
  const { cameras, selectedCameraId, isScanning, hasTorch, isTorchOn, zoom, zoomLevel,
    errorMessage, toggleTorch, switchCamera, handleZoom, start: startScanner } = scanner;
  const handleClose = async () => { await scanner.stop(); onClose(); };
  const handleCameraChange = (id: string) => { if (id && id !== selectedCameraId) void scanner.start(id); };
  useEffect(() => {
    if (scanner.status !== 'RUNNING') {
      lastScanTimeRef.current = 0;
      lastScannedCodeRef.current = null;
      setLastScannedCode(null);
    }
  }, [scanner.status]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      placement="center"
      backdrop="blur"
      hideCloseButton
      classNames={{
        base: "bg-background border border-default-200 shadow-2xl rounded-3xl overflow-hidden max-w-xl",
        body: "p-0",
      }}
    >
      <ModalContent>
        {() => (
          <>
            {/* ENCABEZADO */}
            <ModalHeader className="px-5 py-4 flex items-center justify-between border-b border-default-100 bg-default-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <FaBarcode className="text-lg" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                    Lector de Código de Barras / QR
                    <Chip size="sm" color="primary" variant="flat" className="font-bold text-[10px]">
                      HD Instantáneo
                    </Chip>
                  </h3>
                  <p className="text-xs text-default-400 font-normal">
                    Apunta la cámara a cualquier código 1D o QR para detectarlo
                  </p>
                </div>
              </div>

              <Button
                isIconOnly
                size="sm"
                variant="light"
                radius="full"
                onPress={handleClose}
                className="text-default-400 hover:text-danger"
              >
                <FaXmark className="text-base" />
              </Button>
            </ModalHeader>

            {/* VISOR DE CÁMARA */}
            <ModalBody onClick={scanner.focusOnTap} className="relative bg-black flex flex-col items-center justify-center min-h-[320px] sm:min-h-[380px] max-h-[480px] overflow-hidden">
              {/* Contenedor HTML5-QRCode */}
              <div
                ref={scanner.containerRef}
                id={scannerContainerId}
                className="w-full h-full flex items-center justify-center overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-contain "
              />

              <CameraFocusIndicator point={scanner.focusPoint} onDone={scanner.clearFocus} />
              {/* OVERLAY VISUAL DE ESCANEO LÁSER */}
              {isScanning && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative w-72 h-44 sm:w-84 sm:h-52 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
                    {/* Esquinas de enfoque */}
                    <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                    <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                    <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                    {/* Línea de escaneo láser */}
                    <div className="absolute inset-x-2 top-0 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" />
                    <div className="absolute inset-x-0 bottom-2 text-center">
                      <span className="text-[10px] text-white/80 font-mono tracking-wider bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        Centra el código y acerca o aleja el teléfono para enfocar
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* AVISO DE ERROR O PERMISOS */}
              {errorMessage && (
                <div className="absolute inset-0 bg-background/95 p-6 flex flex-col items-center justify-center text-center gap-3 z-20">
                  <div className="p-3 bg-danger/10 text-danger rounded-2xl">
                    <FaCamera className="text-3xl" />
                  </div>
                  <p className="font-bold text-sm text-foreground">{errorMessage}</p>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={() => {
                      startScanner(selectedCameraId || undefined);
                    }}
                    startContent={<FaRotate />}
                  >
                    Reintentar Conexión
                  </Button>
                </div>
              )}

              {/* BADGE FLOTANTE DE ÚLTIMO CÓDIGO DETECTADO */}
              {lastScannedCode && (
                <div className="absolute top-3 inset-x-0 flex justify-center z-10 px-4">
                  <div className="bg-emerald-600/90 text-white backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold animate-bounce">
                    <FaCircleCheck className="text-sm" />
                    <span className="truncate max-w-[260px]">Detectado: {lastScannedCode}</span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md">+1</span>
                  </div>
                </div>
              )}
            </ModalBody>

            {/* CONTROLES INFERIORES */}
            <ModalFooter className="px-5 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-default-100 bg-default-50/50">
              {scanner.warning && <p role="status" className="text-xs text-warning">{scanner.warning.message}</p>}
              {/* Selección de Cámara, Linterna & Zoom */}
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                {cameras.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Select
                      size="sm"
                      aria-label="Cámara"
                      selectedKeys={selectedCameraId ? [selectedCameraId] : []}
                      onChange={(e) => handleCameraChange(e.target.value)}
                      className="w-36 sm:w-44"
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
                      title="Cambiar a la siguiente cámara"
                      className="h-8 w-8 min-w-8"
                    >
                      <FaRotate className="text-xs" />
                    </Button>
                  </div>
                )}

                {/* Linterna */}
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
                    {isTorchOn ? "Apagar Luz" : "Luz"}
                  </Button>
                )}

                {/* Controles de Zoom */}
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
                  <span className="text-[11px] font-mono font-bold px-1.5 min-w-[32px] text-center text-default-600">
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

              {/* Modo Continuo & Botón Cerrar */}
              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="flex items-center gap-1.5">
                  <Switch
                    size="sm"
                    isSelected={continuousScan}
                    onValueChange={setContinuousScan}
                    color="primary"
                  />
                  <span className="text-xs font-semibold text-default-600 select-none cursor-pointer" onClick={() => setContinuousScan(!continuousScan)}>
                    Continuo
                  </span>
                </div>

                <Button
                  size="sm"
                  color="default"
                  variant="flat"
                  radius="lg"
                  onPress={handleClose}
                  className="font-medium text-xs h-8 px-4"
                >
                  Listo
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};
