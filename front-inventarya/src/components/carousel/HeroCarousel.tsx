import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICarousel } from '@/interface/landing.interface';
import { LuChevronLeft, LuChevronRight, LuStore, LuLaptop, LuWarehouse, LuArrowRight } from 'react-icons/lu';

interface HeroCarouselProps {
  slides?: ICarousel[];
}

const AUTOPLAY_INTERVAL = 6000;

// Per-slide gradient themes
const SLIDE_THEMES = [
  'from-blue-950 via-slate-900 to-indigo-950',
  'from-emerald-950 via-slate-900 to-teal-950',
  'from-purple-950 via-slate-900 to-indigo-950',
];

const GLOW_COLORS = [
  ['bg-blue-500/25', 'bg-indigo-500/20'],
  ['bg-emerald-500/25', 'bg-teal-500/20'],
  ['bg-purple-500/25', 'bg-violet-500/20'],
];

const DEFAULT_SLIDES: ICarousel[] = [
  {
    id: 1,
    title: 'Punto de Venta (POS) Táctil y Veloz',
    description: 'Cobro ágil con lector de códigos de barra, ticketera térmica y control de caja en tiempo real desde cualquier dispositivo.',
    image: null,
    image_key: null,
    display_order: 1,
    status: 'active',
    title_btn: 'Explorar POS & Planes',
    link: '#planes',
    color_btn: '#006fee',
    position_btn: 'left',
    visible_btn: true,
  },
  {
    id: 2,
    title: 'Control de Stock, Almacenes y Kardex',
    description: 'Trazabilidad completa de inventarios por sucursal, alertas de stock mínimo y valoración automática de mercadería.',
    image: null,
    image_key: null,
    display_order: 2,
    status: 'active',
    title_btn: 'Buscar mi Tienda',
    link: '#buscar-tienda',
    color_btn: '#17c964',
    position_btn: 'left',
    visible_btn: true,
  },
  {
    id: 3,
    title: 'Multi-Sucursales & Gestión Centralizada',
    description: 'Administra múltiples almacenes y tiendas físicas simultáneamente con sincronización en vivo y reportes ejecutivos.',
    image: null,
    image_key: null,
    display_order: 3,
    status: 'active',
    title_btn: 'Comenzar Ahora',
    link: '#planes',
    color_btn: '#7828c8',
    position_btn: 'center',
    visible_btn: true,
  },
];

export const HeroCarousel: React.FC<HeroCarouselProps> = ({ slides = [] }) => {
  const navigate = useNavigate();
  const activeSlides = slides && slides.length > 0 ? slides : DEFAULT_SLIDES;
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Touch gesture state for mobile/Android
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const total = activeSlides.length;

  const go = useCallback(
    (nextIdx: number, dir: 'next' | 'prev') => {
      if (isAnimating || total <= 1) return;
      setDirection(dir);
      setIsAnimating(true);
      setTimeout(() => {
        setCurrent(nextIdx);
        setIsAnimating(false);
      }, 500);
    },
    [isAnimating, total]
  );

  const next = useCallback(() => {
    go((current + 1) % total, 'next');
  }, [current, go, total]);

  const prev = useCallback(() => {
    go((current - 1 + total) % total, 'prev');
  }, [current, go, total]);

  // Autoplay
  useEffect(() => {
    if (total <= 1 || isPaused) return;
    timerRef.current = setInterval(next, AUTOPLAY_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, isPaused, next]);

  // Touch handlers for mobile/Android swipe without opening new tabs
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 45;
    const isRightSwipe = distance < -45;

    if (isLeftSwipe) {
      next();
    } else if (isRightSwipe) {
      prev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (total === 0) return null;
  const slide = activeSlides[current];
  if (!slide) return null;

  const slideTheme = SLIDE_THEMES[current % SLIDE_THEMES.length];
  const [glow1, glow2] = GLOW_COLORS[current % GLOW_COLORS.length];

  const contentAlign =
    slide.position_btn === 'left'
      ? 'items-start text-left'
      : slide.position_btn === 'right'
        ? 'items-end text-right'
        : 'items-center text-center';

  const handleBtnClick = () => {
    if (!slide.link) return;
    if (slide.link.startsWith('#')) {
      const sectionId = slide.link.slice(1);
      const elem = document.getElementById(sectionId);
      if (elem) { elem.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    }
    if (slide.link.startsWith('/')) { navigate(slide.link); return; }
    window.location.href = slide.link;
  };

  const getSlideIcon = (index: number) => {
    switch (index % 3) {
      case 0: return <LuLaptop className="w-4 h-4" />;
      case 1: return <LuWarehouse className="w-4 h-4" />;
      default: return <LuStore className="w-4 h-4" />;
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl group select-none"
      style={{ aspectRatio: '16 / 7', maxHeight: '520px' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="Destacados de la plataforma"
    >
      {/* ── Background ── */}
      <div className={`absolute inset-0 bg-gradient-to-br ${slideTheme} transition-colors duration-700`}>
        <div className={`absolute -top-16 -left-16 w-72 h-72 ${glow1} rounded-full blur-3xl pointer-events-none transition-colors duration-700`} />
        <div className={`absolute -bottom-16 -right-16 w-72 h-72 ${glow2} rounded-full blur-3xl pointer-events-none transition-colors duration-700`} />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff07_1px,transparent_1px)] [background-size:20px_20px]" />

        {slide.image && (
          <img
            src={slide.image}
            alt={slide.title}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
              isAnimating ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
            }`}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            draggable={false}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
      </div>

      {/* ── Content ── */}
      <div
        className={`relative z-10 h-full flex flex-col justify-end p-5 sm:p-8 lg:p-10 gap-2 ${contentAlign} transition-all duration-450 ${
          isAnimating
            ? direction === 'next' ? '-translate-x-4 opacity-0' : 'translate-x-4 opacity-0'
            : 'translate-x-0 opacity-100'
        }`}
      >
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-white text-[11px] font-semibold w-fit">
          {getSlideIcon(current)}
          <span>Inventarya Platform</span>
        </div>

        <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-white leading-tight drop-shadow-lg max-w-2xl">
          {slide.title}
        </h2>

        {slide.description && (
          <p className="text-white/75 text-xs sm:text-sm max-w-xl leading-relaxed hidden sm:block">
            {slide.description}
          </p>
        )}

        {slide.visible_btn && slide.title_btn && (
          <button
            type="button"
            onClick={handleBtnClick}
            className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-extrabold text-white shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer w-fit mt-1"
            style={{ background: slide.color_btn || '#006fee' }}
          >
            <span>{slide.title_btn}</span>
            <LuArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Progress bar ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-0.5 bg-white/10">
        <div
          key={`progress-${current}`}
          className="h-full bg-white/50 origin-left"
          style={{ animation: !isPaused ? `hero-progress ${AUTOPLAY_INTERVAL}ms linear forwards` : 'none' }}
        />
      </div>

      {/* ── Navigation arrows (revealed on hover) ── */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Slide anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/60 hover:scale-110 active:scale-95 transition-all duration-150 backdrop-blur-sm border border-white/10 opacity-0 group-hover:opacity-100"
          >
            <LuChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Siguiente slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/30 text-white hover:bg-black/60 hover:scale-110 active:scale-95 transition-all duration-150 backdrop-blur-sm border border-white/10 opacity-0 group-hover:opacity-100"
          >
            <LuChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* ── Dot indicators (bottom-right) ── */}
      {total > 1 && (
        <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
          {activeSlides.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => go(i, i > current ? 'next' : 'prev')}
              aria-label={`Ir al slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/35 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}

      {/* ── Slide counter (top-right) ── */}
      {total > 1 && (
        <div className="absolute top-3 right-4 z-20 text-[10px] text-white/50 font-bold tabular-nums">
          {current + 1} / {total}
        </div>
      )}

      <style>{`
        @keyframes hero-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
};
