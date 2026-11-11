import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Chip,
  Spinner,
  Tooltip,
} from "@nextui-org/react";
import {
  LuTag,
  LuSearch,
  LuCheck,
  LuLayers,
  LuX,
  LuSparkles,
} from "react-icons/lu";
import { useBrandsStore } from "@/modules/tenant/products/store/brands/brands.store";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { getImageUrl } from "@/utils/image";
import { IBrandResponse } from "@/interface";

interface ModalBrandsProps {
  isOpen: boolean;
  onClose: () => void;
  selectBrands: (brandSlugOrName: string) => void;
  currentBrand?: string;
}

export const ModalBrands: React.FC<ModalBrandsProps> = ({
  isOpen,
  onClose,
  selectBrands,
  currentBrand = "",
}) => {
  const token = useTenantAuthStore((state) => state.token);
  const brands = useBrandsStore((state) => state.brands);
  const getBrands = useBrandsStore((state) => state.getBrands);
  const isLoading = useBrandsStore((state) => state.isLoading);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>(currentBrand || "");

  // Gesto táctil estilo bottom sheet: arrastrar hacia abajo para cerrar
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const touchStartY = useRef(0);

  const handleDragTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("input") || target.closest("select")) {
      return;
    }
    touchStartY.current = e.touches[0].clientY;
    setIsDraggingSheet(true);
  };

  const handleDragTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingSheet) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    } else {
      setDragOffsetY(0);
    }
  };

  const handleDragTouchEnd = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);
    if (dragOffsetY > 75) {
      onClose();
    }
    setDragOffsetY(0);
  };

  // Bloqueo de scroll de fondo mientras esté abierto
  useEffect(() => {
    if (isOpen) {
      const mainEl = (document.getElementById("pos-main") || document.querySelector("main")) as HTMLElement | null;
      const prevBodyOverflow = document.body.style.overflow;
      const prevMainOverflow = mainEl?.style.overflow;

      document.body.style.overflow = "hidden";
      if (mainEl) mainEl.style.overflow = "hidden";

      return () => {
        document.body.style.overflow = prevBodyOverflow || "";
        if (mainEl) mainEl.style.overflow = prevMainOverflow || "";
      };
    }
  }, [isOpen]);

  // Sincronizar selección actual cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setSelectedBrand(currentBrand || "");
      setSearchQuery("");
      if (brands.length === 0 && token) {
        getBrands(token);
      }
    }
  }, [isOpen, currentBrand, brands.length, token, getBrands]);

  // Filtrado reactivo en tiempo real
  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase().trim();
    return brands.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.slug?.toLowerCase().includes(q)
    );
  }, [brands, searchQuery]);

  // Obtener objeto de la marca seleccionada
  const selectedBrandObj = useMemo(() => {
    if (!selectedBrand) return null;
    return brands.find(
      (b) =>
        b.slug === selectedBrand ||
        b.name?.toLowerCase() === selectedBrand.toLowerCase()
    );
  }, [brands, selectedBrand]);

  const handleSelectCard = (brandSlug: string) => {
    setSelectedBrand(brandSlug);
  };

  const handleApply = (brandToApply?: string) => {
    const finalBrand = brandToApply !== undefined ? brandToApply : selectedBrand;
    selectBrands(finalBrand);
    onClose();
  };

  const handleClear = () => {
    setSelectedBrand("");
    handleApply("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      backdrop="opaque"
      placement="bottom-center"
      hideCloseButton
      motionProps={{
        variants: {
          enter: {
            y: 0,
            opacity: 1,
            transition: {
              duration: 0.22,
              ease: [0.16, 1, 0.3, 1],
            },
          },
          exit: {
            y: "100%",
            opacity: 0,
            transition: {
              duration: 0.18,
              ease: [0.7, 0, 0.84, 0],
            },
          },
        },
      }}
      classNames={{
        backdrop: "bg-black/60 backdrop-blur-sm",
        base: "bg-content1 border border-divider shadow-2xl rounded-t-[28px] rounded-b-none sm:rounded-3xl max-w-3xl w-full m-0 sm:mx-auto max-h-[90dvh] sm:max-h-[85vh] overflow-hidden flex flex-col",
        header: "border-b border-divider/60 py-3.5 sm:py-4 px-4 sm:px-6 shrink-0",
        body: "py-4 sm:py-5 px-4 sm:px-6 overflow-y-auto flex-1 overscroll-contain",
        footer: "border-t border-divider/60 py-3 sm:py-4 px-4 sm:px-6 shrink-0",
      }}
    >
      <ModalContent
        className="max-h-[90dvh] sm:max-h-[85vh] flex flex-col"
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: isDraggingSheet ? "none" : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {() => (
          <>
            {/* Indicador visual de bottom sheet (handle para arrastrar hacia abajo) */}
            <div
              className="sm:hidden w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing select-none touch-none"
              onTouchStart={handleDragTouchStart}
              onTouchMove={handleDragTouchMove}
              onTouchEnd={handleDragTouchEnd}
              onClick={onClose}
              title="Deslizar hacia abajo o tocar para cerrar"
            >
              <div className="h-1.5 w-12 rounded-full bg-default-300 dark:bg-default-600 transition-colors active:bg-default-400" />
            </div>

            {/* Header del Modal */}
            <ModalHeader
              className="flex items-center justify-between gap-3 shrink-0 select-none"
              onTouchStart={handleDragTouchStart}
              onTouchMove={handleDragTouchMove}
              onTouchEnd={handleDragTouchEnd}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <LuTag size={20} />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-foreground truncate">
                    Filtrar por Marca
                  </h3>
                  <p className="text-xs text-default-500 font-normal line-clamp-1">
                    Selecciona una marca para filtrar los productos en catálogo e inventario
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="font-semibold text-xs shrink-0 hidden sm:flex"
                >
                  {brands.length} {brands.length === 1 ? "marca" : "marcas"}
                </Chip>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  radius="full"
                  aria-label="Cerrar modal"
                  onPress={onClose}
                  className="h-8 w-8 min-w-8 bg-default-100 dark:bg-default-100/50 text-default-500 hover:text-foreground active:scale-95 transition-all"
                >
                  <LuX size={15} />
                </Button>
              </div>
            </ModalHeader>

            {/* Cuerpo del Modal */}
            <ModalBody className="gap-4 flex-1 overflow-y-auto">
              {/* Barra de búsqueda y accesos rápidos */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                <Input
                  size="sm"
                  variant="bordered"
                  radius="lg"
                  placeholder="Buscar marca por nombre..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  isClearable
                  onClear={() => setSearchQuery("")}
                  startContent={<LuSearch className="text-default-400" size={16} />}
                  className="flex-1"
                  classNames={{
                    inputWrapper: "h-9 border-default-200 bg-default-50/50 dark:bg-default-100/20",
                    input: "text-xs sm:text-sm",
                  }}
                />

                {selectedBrand && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    startContent={<LuX size={14} />}
                    onPress={handleClear}
                    className="h-9 text-xs font-semibold shrink-0"
                  >
                    Quitar Filtro
                  </Button>
                )}
              </div>

              {/* Contenedor de Marcas */}
              {isLoading && brands.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[220px] gap-3">
                  <Spinner size="md" color="primary" />
                  <p className="text-xs text-default-400 font-medium">Cargando catálogo de marcas...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-1">
                  {/* Tarjeta especial: Todas las marcas */}
                  {!searchQuery && (
                    <div
                      onClick={() => handleSelectCard("")}
                      onDoubleClick={() => handleApply("")}
                      className={`relative group cursor-pointer border rounded-2xl p-3 flex flex-col items-center justify-center text-center gap-2 transition-all duration-200 select-none ${!selectedBrand
                          ? "border-primary bg-primary-50/60 dark:bg-primary-950/30 ring-2 ring-primary/40 shadow-sm"
                          : "border-default-200/80 hover:border-primary/50 hover:bg-default-50/60"
                        }`}
                    >
                      {!selectedBrand && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] shadow-sm">
                          <LuCheck size={12} />
                        </span>
                      )}
                      <div className="flex flex-col items-center min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                          Todas las marcas
                        </span>
                        <span className="text-[10px] text-default-400">Sin filtro</span>
                      </div>
                    </div>
                  )}

                  {/* Tarjetas de Marcas */}
                  {filteredBrands.map((brand: IBrandResponse) => {
                    const isSelected =
                      selectedBrand === brand.slug ||
                      selectedBrand.toLowerCase() === brand.name?.toLowerCase();
                    const logoUrl = getImageUrl(brand.logo || brand.image);

                    return (
                      <div
                        key={brand.id}
                        onClick={() => handleSelectCard(brand.slug)}
                        onDoubleClick={() => handleApply(brand.slug)}
                        className={`relative group cursor-pointer border rounded-2xl p-3 flex flex-col items-center justify-between text-center gap-2 transition-all duration-200 select-none min-h-[130px] ${isSelected
                            ? "border-primary bg-primary-50/60 dark:bg-primary-950/30 ring-2 ring-primary/40 shadow-sm"
                            : "border-default-200/80 hover:border-primary/50 hover:bg-default-50/60"
                          }`}
                      >
                        {isSelected && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] shadow-sm z-10">
                            <LuCheck size={12} />
                          </span>
                        )}

                        {/* Imagen / Logo de Marca */}
                        <div className="w-full h-16 rounded-xl bg-default-100/70 dark:bg-default-50/20 flex items-center justify-center overflow-hidden p-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={brand.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                              {brand.name ? brand.name.substring(0, 2).toUpperCase() : <LuTag size={18} />}
                            </div>
                          )}
                        </div>

                        {/* Nombre de la Marca */}
                        <div className="flex flex-col items-center w-full min-w-0">
                          <Tooltip content={brand.name} delay={600} closeDelay={0}>
                            <span className="font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors truncate max-w-full">
                              {brand.name}
                            </span>
                          </Tooltip>
                          {brand.slug && (
                            <span className="text-[10px] font-mono text-default-400 truncate max-w-full">
                              {brand.slug}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Estado vacío cuando no hay coincidencias de búsqueda */}
              {!isLoading && filteredBrands.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center justify-center gap-2 text-default-400">
                  <div className="p-3 rounded-full bg-default-100 text-default-400">
                    <LuTag size={28} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    No se encontraron marcas
                  </p>
                  <p className="text-xs text-default-400 max-w-xs">
                    No existe ninguna marca que coincida con "{searchQuery}".
                  </p>
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    onPress={() => setSearchQuery("")}
                    className="mt-1 font-semibold text-xs"
                  >
                    Ver todas las marcas
                  </Button>
                </div>
              )}
            </ModalBody>

            {/* Footer del Modal */}
            <ModalFooter className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-default-500 shrink-0">Selección:</span>
                {selectedBrand ? (
                  <Chip
                    size="sm"
                    variant="flat"
                    color="secondary"
                    className="font-bold text-xs truncate max-w-[200px]"
                    onClose={handleClear}
                  >
                    {selectedBrandObj?.name || selectedBrand}
                  </Chip>
                ) : (
                  <span className="text-xs font-semibold text-default-600 flex items-center gap-1">
                    <LuSparkles size={13} className="text-primary" /> Todas las marcas
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  size="sm"
                  variant="flat"
                  color="default"
                  onPress={onClose}
                  className="font-semibold text-xs flex-1 sm:flex-none"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  variant="solid"
                  startContent={<LuCheck size={16} />}
                  onPress={() => handleApply()}
                  className="font-bold text-xs shadow-sm flex-1 sm:flex-none"
                >
                  {selectedBrand ? "Aplicar Filtro" : "Mostrar Todas"}
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};