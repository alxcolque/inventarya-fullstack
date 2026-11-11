import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  Skeleton,
  Tooltip,
  useDisclosure,
} from '@nextui-org/react';
import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuGripVertical,
  LuEye,
  LuEyeOff,
  LuChevronLeft,
  LuChevronRight,
  LuRefreshCw,
  LuLayoutTemplate,
} from 'react-icons/lu';
import { useCarouselStore } from '../store/carousel.store';
import { ICarousel } from '../interfaces/carousel.interface';
import { CarouselModal } from '../components/CarouselModal';
import { DeleteCarouselModal } from '../components/DeleteCarouselModal';
import { DynamicBreadcrumbs } from '@/components';

// ─── Mini Live Preview ────────────────────────────────────────────────────────
const MiniPreview: React.FC<{ slides: ICarousel[] }> = ({ slides }) => {
  const active = slides.filter((s) => s.status === 'active');
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIdx(0);
  }, [active.length]);

  useEffect(() => {
    if (active.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % active.length);
    }, 3500);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active.length]);

  const prev = () => setIdx((i) => (i - 1 + active.length) % active.length);
  const next = () => setIdx((i) => (i + 1) % active.length);

  if (active.length === 0) {
    return (
      <div className="w-full h-52 rounded-2xl bg-content2 border border-dashed border-divider flex flex-col items-center justify-center text-default-400 gap-2">
        <LuLayoutTemplate className="w-10 h-10" />
        <p className="text-sm font-medium">Sin slides activos para previsualizar</p>
      </div>
    );
  }

  const slide = active[idx];
  const align =
    slide.position_btn === 'left'
      ? 'items-start text-left'
      : slide.position_btn === 'right'
        ? 'items-end text-right'
        : 'items-center text-center';

  return (
    <div className="relative w-full h-52 rounded-2xl overflow-hidden shadow-md select-none group">
      {/* BG */}
      {slide.image ? (
        <img
          src={slide.image}
          alt={slide.title}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-secondary/60" />
      )}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className={`relative z-10 h-full flex flex-col justify-end p-5 gap-2 ${align}`}>
        <h3 className="text-white font-black text-lg leading-tight drop-shadow-md line-clamp-2">
          {slide.title}
        </h3>
        {slide.description && (
          <p className="text-white/80 text-xs leading-snug line-clamp-2">{slide.description}</p>
        )}
        {slide.visible_btn && slide.title_btn && (
          <span
            className="mt-1 px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm"
            style={{ background: slide.color_btn || '#3b82f6' }}
          >
            {slide.title_btn}
          </span>
        )}
      </div>

      {/* Nav arrows */}
      {active.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
          >
            <LuChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors opacity-0 group-hover:opacity-100"
          >
            <LuChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Dots */}
      {active.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
          {active.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === idx ? 'bg-white scale-125' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* Slide counter badge */}
      <div className="absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs font-semibold">
        {idx + 1} / {active.length}
      </div>
    </div>
  );
};

// ─── Slide Card ───────────────────────────────────────────────────────────────
interface SlideCardProps {
  carousel: ICarousel;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}

const SlideCard: React.FC<SlideCardProps> = ({ carousel, onEdit, onDelete, index }) => {
  return (
    <Card
      className={`border border-divider shadow-sm hover:shadow-md transition-shadow ${
        carousel.status === 'inactive' ? 'opacity-60' : ''
      }`}
    >
      {/* Image */}
      <div className="relative w-full h-36 overflow-hidden rounded-t-xl">
        {carousel.image ? (
          <img src={carousel.image} alt={carousel.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-default-100 to-default-200 flex items-center justify-center">
            <LuLayoutTemplate className="w-8 h-8 text-default-400" />
          </div>
        )}
        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <Chip size="sm" className="text-xs font-bold bg-black/60 text-white border-0">
            #{index + 1}
          </Chip>
          <Chip
            size="sm"
            color={carousel.status === 'active' ? 'success' : 'default'}
            variant="flat"
            className="text-xs font-semibold"
          >
            {carousel.status === 'active' ? 'Activo' : 'Inactivo'}
          </Chip>
        </div>
        {carousel.visible_btn && (
          <div className="absolute bottom-2 right-2">
            <Chip size="sm" color="primary" variant="flat" className="text-xs">
              CTA
            </Chip>
          </div>
        )}
      </div>

      <CardBody className="p-3 gap-1">
        <h4 className="text-sm font-bold text-foreground line-clamp-1">{carousel.title}</h4>
        {carousel.description && (
          <p className="text-xs text-default-400 line-clamp-2">{carousel.description}</p>
        )}
        {carousel.link && (
          <p className="text-xs text-primary truncate mt-0.5">🔗 {carousel.link}</p>
        )}
      </CardBody>

      <CardFooter className="p-3 pt-0 flex gap-2 justify-end">
        <Tooltip content="Editar">
          <Button isIconOnly size="sm" variant="flat" onPress={onEdit}>
            <LuPencil className="w-3.5 h-3.5" />
          </Button>
        </Tooltip>
        <Tooltip content="Eliminar" color="danger">
          <Button isIconOnly size="sm" variant="flat" color="danger" onPress={onDelete}>
            <LuTrash2 className="w-3.5 h-3.5 text-danger" />
          </Button>
        </Tooltip>
      </CardFooter>
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const CarouselPage: React.FC = () => {
  const { carousels, isLoading, getCarousels } = useCarouselStore();
  const [selectedCarousel, setSelectedCarousel] = useState<ICarousel | null>(null);
  const [carouselToDelete, setCarouselToDelete] = useState<ICarousel | null>(null);

  const { isOpen: isFormOpen, onOpen: openForm, onClose: closeForm } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();

  useEffect(() => {
    getCarousels();
  }, [getCarousels]);

  const handleEdit = (carousel: ICarousel) => {
    setSelectedCarousel(carousel);
    openForm();
  };

  const handleNew = () => {
    setSelectedCarousel(null);
    openForm();
  };

  const handleDelete = (carousel: ICarousel) => {
    setCarouselToDelete(carousel);
    openDelete();
  };

  const activeCount = carousels.filter((c) => c.status === 'active').length;

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-7xl mx-auto w-full">
      <DynamicBreadcrumbs title="Carrusel" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-content1 p-6 rounded-2xl border border-divider shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">Carrusel de Landing Page</h1>
            <Chip size="sm" color="primary" variant="flat" className="font-semibold">
              {activeCount} activos
            </Chip>
          </div>
          <p className="text-default-500 text-sm mt-1">
            Administra los slides del carrusel principal. Aparecen en la página de inicio por orden de visualización.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="flat"
            startContent={<LuRefreshCw className="w-4 h-4" />}
            onPress={getCarousels}
            isDisabled={isLoading}
          >
            Actualizar
          </Button>
          <Button
            color="primary"
            startContent={<LuPlus className="w-4 h-4" />}
            onPress={handleNew}
            className="font-semibold"
          >
            Nuevo Slide
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border border-divider">
              <Skeleton className="h-36 rounded-t-xl" />
              <CardBody className="p-3 gap-2">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-3 w-full rounded-md" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Slides Grid */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <h2 className="text-base font-bold text-foreground">
              Slides ({carousels.length})
            </h2>
            {carousels.length === 0 ? (
              <Card className="border-2 border-dashed border-divider">
                <CardBody className="flex flex-col items-center justify-center py-16 gap-3 text-default-400">
                  <LuLayoutTemplate className="w-12 h-12" />
                  <p className="text-base font-semibold">Sin slides creados</p>
                  <p className="text-sm text-center max-w-xs">
                    Agrega el primer slide para que aparezca en la Landing Page.
                  </p>
                  <Button color="primary" onPress={handleNew} startContent={<LuPlus className="w-4 h-4" />}>
                    Crear Primer Slide
                  </Button>
                </CardBody>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {carousels.map((carousel, i) => (
                  <SlideCard
                    key={carousel.id}
                    carousel={carousel}
                    index={i}
                    onEdit={() => handleEdit(carousel)}
                    onDelete={() => handleDelete(carousel)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Live Preview */}
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-bold text-foreground">Vista Previa en Vivo</h2>
            <Card className="border border-divider shadow-sm p-4">
              <MiniPreview slides={carousels} />
              <p className="text-xs text-default-400 text-center mt-3">
                Vista previa de slides activos · Autoplay cada 3.5s
              </p>
              {activeCount !== carousels.length && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-warning-600 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg px-3 py-2">
                  <LuEyeOff className="w-3.5 h-3.5 flex-shrink-0" />
                  {carousels.length - activeCount} slide(s) inactivo(s) no se muestran
                </div>
              )}
            </Card>

            {/* Stats */}
            <Card className="border border-divider shadow-sm">
              <CardBody className="p-4 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-success-50 dark:bg-success-900/20">
                  <p className="text-2xl font-black text-success">{activeCount}</p>
                  <p className="text-xs text-success-600 font-semibold flex items-center gap-1">
                    <LuEye className="w-3 h-3" /> Activos
                  </p>
                </div>
                <div className="flex flex-col gap-0.5 p-3 rounded-xl bg-default-100">
                  <p className="text-2xl font-black text-default-600">
                    {carousels.length - activeCount}
                  </p>
                  <p className="text-xs text-default-500 font-semibold flex items-center gap-1">
                    <LuEyeOff className="w-3 h-3" /> Inactivos
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Modals */}
      <CarouselModal isOpen={isFormOpen} onClose={closeForm} carousel={selectedCarousel} />
      <DeleteCarouselModal isOpen={isDeleteOpen} onClose={closeDelete} carousel={carouselToDelete} />
    </div>
  );
};
