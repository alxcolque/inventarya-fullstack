import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Switch,
  Select,
  SelectItem,
} from '@nextui-org/react';
import { useForm, Controller } from 'react-hook-form';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { LuUpload, LuImage, LuX, LuCrop, LuCheck } from 'react-icons/lu';
import { ICarousel, ICarouselFormValues } from '../interfaces/carousel.interface';
import { useCarouselStore } from '../store/carousel.store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recorta un canvas a partir de la imagen original y el área del crop. */
async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width  = cropArea.width;
      canvas.height = cropArea.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.drawImage(
        image,
        cropArea.x, cropArea.y,
        cropArea.width, cropArea.height,
        0, 0,
        cropArea.width, cropArea.height,
      );
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', 0.92);
    });
    image.addEventListener('error', reject);
    image.src = imageSrc;
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ASPECT_RATIO = 16 / 7; // ratio fijo para todos los slides

const POSITION_OPTIONS = [
  { key: 'left',   label: 'Izquierda' },
  { key: 'center', label: 'Centro'    },
  { key: 'right',  label: 'Derecha'   },
];

const STATUS_OPTIONS = [
  { key: 'active',   label: 'Activo'   },
  { key: 'inactive', label: 'Inactivo' },
];

// ─── Image Cropper Panel ──────────────────────────────────────────────────────

interface CropPanelProps {
  src: string;
  onConfirm: (blob: Blob, preview: string) => void;
  onCancel: () => void;
}

const CropPanel: React.FC<CropPanelProps> = ({ src, onConfirm, onCancel }) => {
  const [crop, setCrop]       = useState({ x: 0, y: 0 });
  const [zoom, setZoom]       = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setIsProcessing(true);
    try {
      const blob    = await getCroppedBlob(src, croppedArea);
      const preview = URL.createObjectURL(blob);
      onConfirm(blob, preview);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Crop area */}
      <div
        className="relative w-full rounded-xl overflow-hidden bg-black"
        style={{ height: 240 }}
      >
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={ASPECT_RATIO}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-default-400 w-10 shrink-0">Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="text-xs text-default-400 w-8 text-right shrink-0">
          {zoom.toFixed(1)}x
        </span>
      </div>

      <p className="text-xs text-default-400 text-center -mt-1">
        Relación de aspecto fija 16:7 · arrastra y ajusta el zoom para encuadrar
      </p>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="flat"
          startContent={<LuX className="w-3.5 h-3.5" />}
          onPress={onCancel}
          isDisabled={isProcessing}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          color="primary"
          startContent={<LuCheck className="w-3.5 h-3.5" />}
          onPress={handleConfirm}
          isLoading={isProcessing}
        >
          Aplicar recorte
        </Button>
      </div>
    </div>
  );
};

// ─── Modal Props ──────────────────────────────────────────────────────────────

interface CarouselModalProps {
  isOpen: boolean;
  onClose: () => void;
  carousel?: ICarousel | null;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const CarouselModal: React.FC<CarouselModalProps> = ({ isOpen, onClose, carousel }) => {
  const { createCarousel, updateCarousel, isSaving } = useCarouselStore();

  // Image state
  const [rawSrc, setRawSrc]           = useState<string | null>(null);   // src para el cropper
  const [isCropping, setIsCropping]   = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [preview, setPreview]         = useState<string | null>(null);
  const imageInputRef                 = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<ICarouselFormValues>({
    defaultValues: {
      title:        '',
      description:  '',
      link:         '',
      visible_btn:  false,
      title_btn:    '',
      color_btn:    '#3b82f6',
      position_btn: 'center',
      display_order: 0,
      status:       'active',
    },
  });

  const showBtn = watch('visible_btn');

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setRawSrc(null);
    setIsCropping(false);
    setCroppedBlob(null);

    if (carousel) {
      setPreview(carousel.image || null);
      reset({
        title:        carousel.title,
        description:  carousel.description   || '',
        link:         carousel.link          || '',
        visible_btn:  carousel.visible_btn,
        title_btn:    carousel.title_btn     || '',
        color_btn:    carousel.color_btn     || '#3b82f6',
        position_btn: carousel.position_btn  || 'center',
        display_order: carousel.display_order,
        status:       carousel.status,
      });
    } else {
      setPreview(null);
      reset({
        title:        '',
        description:  '',
        link:         '',
        visible_btn:  false,
        title_btn:    '',
        color_btn:    '#3b82f6',
        position_btn: 'center',
        display_order: 0,
        status:       'active',
      });
    }
  }, [carousel, isOpen, reset]);

  // File selected → show cropper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be selected again
    e.target.value = '';
    const url = URL.createObjectURL(file);
    setRawSrc(url);
    setIsCropping(true);
  };

  const handleCropConfirm = (blob: Blob, previewUrl: string) => {
    setCroppedBlob(blob);
    setPreview(previewUrl);
    setIsCropping(false);
    if (rawSrc) URL.revokeObjectURL(rawSrc);
    setRawSrc(null);
  };

  const handleCropCancel = () => {
    setIsCropping(false);
    if (rawSrc) URL.revokeObjectURL(rawSrc);
    setRawSrc(null);
  };

  const handleRemoveImage = () => {
    setCroppedBlob(null);
    setPreview(null);
  };

  // Form submit
  const onSubmit = async (values: ICarouselFormValues) => {
    const fd = new FormData();
    fd.append('title',         values.title);
    fd.append('description',   values.description);
    fd.append('link',          values.link);
    fd.append('visible_btn',   values.visible_btn ? '1' : '0');
    fd.append('title_btn',     values.title_btn);
    fd.append('color_btn',     values.color_btn);
    fd.append('position_btn',  values.position_btn);
    fd.append('display_order', String(values.display_order));
    fd.append('status',        values.status);

    if (croppedBlob) {
      fd.append('image_file', croppedBlob, 'slide.jpg');
    }

    const ok = carousel
      ? await updateCarousel(carousel.id, fd)
      : await createCarousel(fd);

    if (ok) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      placement="center"
      scrollBehavior="inside"
      classNames={{
        base:    'max-h-[90vh]',
        body:    'overflow-y-auto',
        wrapper: 'overflow-hidden',
      }}
    >
      <ModalContent>
        {(onCloseModal) => (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0">
            {/* ── Header ── */}
            <ModalHeader className="flex flex-col gap-0.5 shrink-0 border-b border-divider pb-3">
              <span className="text-lg font-bold">
                {carousel ? 'Editar Slide' : 'Nuevo Slide de Carrusel'}
              </span>
              <span className="text-xs text-default-400 font-normal">
                Aparece en el carrusel principal de la Landing Page
              </span>
            </ModalHeader>

            {/* ── Body (scrollable) ── */}
            <ModalBody className="flex flex-col gap-4 py-4">

              {/* ── Image / Cropper ── */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Imagen del Slide</p>

                {isCropping && rawSrc ? (
                  <CropPanel
                    src={rawSrc}
                    onConfirm={handleCropConfirm}
                    onCancel={handleCropCancel}
                  />
                ) : (
                  <>
                    {preview ? (
                      /* Preview con botones de acción */
                      <div className="relative w-full rounded-xl overflow-hidden border border-divider group" style={{ aspectRatio: '16/7' }}>
                        <img
                          src={preview}
                          alt="Slide preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                          <Button
                            size="sm"
                            color="primary"
                            variant="solid"
                            startContent={<LuCrop className="w-3.5 h-3.5" />}
                            onPress={() => imageInputRef.current?.click()}
                          >
                            Cambiar
                          </Button>
                          <Button
                            size="sm"
                            color="danger"
                            variant="flat"
                            startContent={<LuX className="w-3.5 h-3.5" />}
                            onPress={handleRemoveImage}
                          >
                            Quitar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Drop zone */
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-divider hover:border-primary bg-default-50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-default-400 hover:text-primary py-8 cursor-pointer"
                        style={{ minHeight: 120 }}
                      >
                        <LuImage className="w-9 h-9" />
                        <span className="text-sm font-medium">Haz clic para seleccionar imagen</span>
                        <span className="text-xs">JPG · PNG · WebP · máx. 5 MB</span>
                        <span className="text-xs text-primary/70 font-medium mt-0.5">
                          Se recortará a relación 16:7
                        </span>
                      </button>
                    )}

                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </>
                )}
              </div>

              {/* ── Título ── */}
              <Input
                label="Título del Slide"
                placeholder="Ej. Gestiona tu inventario en tiempo real"
                variant="bordered"
                size="sm"
                isRequired
                {...register('title', { required: 'El título es obligatorio' })}
                isInvalid={!!errors.title}
                errorMessage={errors.title?.message}
              />

              {/* ── Descripción ── */}
              <Textarea
                label="Descripción"
                placeholder="Subtítulo breve visible sobre el slide..."
                variant="bordered"
                size="sm"
                minRows={2}
                maxRows={3}
                {...register('description')}
              />

              {/* ── Link ── */}
              <Input
                label="Enlace (URL)"
                placeholder="https://..."
                variant="bordered"
                size="sm"
                type="url"
                {...register('link')}
                description="Al hacer clic en el slide, redirige a esta URL."
              />

              {/* ── Botón CTA toggle ── */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-default-50 border border-default-200">
                <div>
                  <p className="text-sm font-semibold">Mostrar Botón de Acción</p>
                  <p className="text-xs text-default-400">Botón CTA superpuesto sobre el slide</p>
                </div>
                <Controller
                  name="visible_btn"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <Switch isSelected={value} onValueChange={onChange} color="primary" size="sm" />
                  )}
                />
              </div>

              {/* ── Opciones del botón (condicional) ── */}
              {showBtn && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Texto del Botón"
                    placeholder="Ver más"
                    variant="bordered"
                    size="sm"
                    {...register('title_btn')}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-default-600 font-medium pl-0.5">Color del Botón</label>
                    <input
                      type="color"
                      {...register('color_btn')}
                      className="w-full h-9 rounded-lg border border-default-300 cursor-pointer px-1 bg-content1"
                    />
                  </div>
                  <Controller
                    name="position_btn"
                    control={control}
                    render={({ field: { value, onChange } }) => (
                      <Select
                        label="Posición"
                        variant="bordered"
                        size="sm"
                        selectedKeys={new Set([value])}
                        onSelectionChange={(keys) => onChange(Array.from(keys)[0])}
                      >
                        {POSITION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.key}>{opt.label}</SelectItem>
                        ))}
                      </Select>
                    )}
                  />
                </div>
              )}

              {/* ── Orden & Estado ── */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Orden de Visualización"
                  type="number"
                  variant="bordered"
                  size="sm"
                  {...register('display_order', { valueAsNumber: true })}
                  description="Números menores aparecen primero"
                />
                <Controller
                  name="status"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <Select
                      label="Estado"
                      variant="bordered"
                      size="sm"
                      selectedKeys={new Set([value])}
                      onSelectionChange={(keys) => onChange(Array.from(keys)[0])}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.key}>{opt.label}</SelectItem>
                      ))}
                    </Select>
                  )}
                />
              </div>
            </ModalBody>

            {/* ── Footer ── */}
            <ModalFooter className="shrink-0 border-t border-divider pt-3">
              <Button variant="flat" size="sm" onPress={onCloseModal} isDisabled={isSaving}>
                Cancelar
              </Button>
              <Button color="primary" size="sm" type="submit" isLoading={isSaving}>
                {carousel ? 'Actualizar Slide' : 'Crear Slide'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
