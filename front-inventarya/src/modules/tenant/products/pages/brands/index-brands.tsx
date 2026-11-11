import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Chip,
  Tooltip,
  Card,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Skeleton,
  Avatar,
} from "@nextui-org/react";
import {
  LuTag,
  LuSearch,
  LuPencil,
  LuTrash2,
  LuEye,
  LuAlertTriangle,
  LuPlus,
  LuImage,
  LuFileSpreadsheet,
} from "react-icons/lu";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useBrandsStore } from "../../store/brands/brands.store";
import { BrandModal, getBrandImageUrl } from "./components/BrandModal";
import { BrandExcelModal } from "./components/BrandExcelModal";
import { IBrandResponse } from "@/interface";

export const IndexBrands = () => {
  const can = useTenantAuthStore((state) => state.can);

  const canCreate = can("brands:create");
  const canUpdate = can("brands:update");
  const canDelete = can("brands:delete");

  const brands = useBrandsStore((state) => state.brands);
  const isLoading = useBrandsStore((state) => state.isLoading);
  const getBrands = useBrandsStore((state) => state.getBrands);
  const createBrand = useBrandsStore((state) => state.createBrand);
  const updateBrand = useBrandsStore((state) => state.updateBrand);
  const deleteBrand = useBrandsStore((state) => state.deleteBrand);
  const deleteAllBrands = useBrandsStore((state) => state.deleteAllBrands);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedBrand, setSelectedBrand] = useState<IBrandResponse | null>(null);

  // Modal para ver detalle rápido
  const [brandToView, setBrandToView] = useState<IBrandResponse | null>(null);

  // Modal para confirmación de eliminación individual
  const [brandToDelete, setBrandToDelete] = useState<IBrandResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Modal para confirmación de eliminación masiva
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState<boolean>(false);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);

  useEffect(() => {
    getBrands();
  }, [getBrands]);

  // Filtrado reactivo en tiempo real
  const filteredBrands = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return brands;

    return brands.filter((b) => {
      const name = b.name?.toLowerCase() || "";
      const slug = b.slug?.toLowerCase() || "";
      const id = String(b.id || "");
      return name.includes(query) || slug.includes(query) || id.includes(query);
    });
  }, [brands, searchQuery]);

  const handleOpenCreateModal = () => {
    setSelectedBrand(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (brand: IBrandResponse) => {
    setSelectedBrand(brand);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (data: { name: string; image?: string | null }) => {
    if (isEditing && selectedBrand?.id) {
      return await updateBrand(selectedBrand.id, data);
    } else {
      return await createBrand(data);
    }
  };

  const handleConfirmDelete = async () => {
    if (!brandToDelete?.id) return;
    try {
      setIsDeleting(true);
      const success = await deleteBrand(brandToDelete.id);
      if (success) {
        setBrandToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    try {
      setIsDeletingAll(true);
      const success = await deleteAllBrands();
      if (success) {
        setIsDeleteAllOpen(false);
      }
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="my-2 px-2 sm:px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-3 pb-12">
      <DynamicBreadcrumbs title="Marcas" />

      {/* Top Bar: Título, contador y botón Nueva Marca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-default-900">Marcas</h3>
          <Chip
            size="sm"
            color="primary"
            variant="flat"
            className="font-semibold text-xs h-6 px-2"
          >
            {brands.length}
          </Chip>
        </div>

        <div className="flex items-center gap-2">
          {canDelete && brands.length > 0 && (
            <Button
              color="danger"
              variant="flat"
              size="sm"
              radius="lg"
              startContent={<LuTrash2 size={15} />}
              isDisabled={isLoading}
              onPress={() => setIsDeleteAllOpen(true)}
              className="font-semibold text-xs px-3 shadow-2xs"
            >
              Eliminar todas
            </Button>
          )}

          <Button
            size="sm"
            variant="flat"
            radius="lg"
            startContent={<LuFileSpreadsheet size={15} />}
            onPress={() => setIsExcelModalOpen(true)}
            className="font-semibold text-xs px-3 text-default-700 bg-default-100 hover:bg-default-200 shadow-2xs"
          >
            Importar / Exportar
          </Button>

          {canCreate && (
            <Button
              color="primary"
              variant="solid"
              size="sm"
              radius="lg"
              startContent={<LuPlus size={15} />}
              onPress={handleOpenCreateModal}
              className="font-semibold text-xs px-3 shadow-sm"
            >
              <span className="hidden sm:inline">Marca</span>  Nueva
            </Button>
          )}
        </div>
      </div>

      {/* Barra de búsqueda compacta */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <Input
          placeholder="Buscar por nombre o slug..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
          isClearable
          size="sm"
          radius="lg"
          variant="flat"
          startContent={<LuSearch size={15} className="text-default-400" />}
          className="w-full sm:max-w-xs"
        />
      </div>

      {/* Tabla de Marcas: Responsive con scroll horizontal y espaciado compacto */}
      <Card className="border-none shadow-sm rounded-2xl bg-content1 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table
            aria-label="Tabla de marcas de productos"
            removeWrapper
            classNames={{
              table: "min-w-[580px] w-full",
              th: "py-2 px-2.5 text-[11px] font-bold uppercase tracking-wider text-default-500 bg-default-100/40 h-8",
              td: "py-1 px-2.5 text-xs",
            }}
          >
            <TableHeader>
              <TableColumn className="uppercase text-[11px] font-bold py-2 px-2.5">MARCA</TableColumn>
              <TableColumn className="uppercase text-[11px] font-bold py-2 px-2.5">SLUG / ENLACE</TableColumn>
              <TableColumn align="end" className="uppercase text-[11px] font-bold text-right py-2 px-2.5">ACCIONES</TableColumn>
            </TableHeader>
            <TableBody
              isLoading={isLoading}
              loadingContent={
                <div className="p-6 flex flex-col items-center gap-2">
                  <Skeleton className="h-5 w-40 rounded-lg" />
                  <Skeleton className="h-5 w-56 rounded-lg" />
                </div>
              }
              emptyContent={
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <div className="p-3 rounded-2xl bg-default-100 text-default-400">
                    <LuTag size={28} />
                  </div>
                  <h3 className="text-sm font-semibold text-default-700">No hay marcas registradas</h3>
                  <p className="text-xs text-default-400 max-w-xs">
                    {searchQuery
                      ? `Sin coincidencias para "${searchQuery}".`
                      : "Registra tus marcas fabricantes para clasificar tus productos (ej. Nike, Samsung, Sony)."}
                  </p>
                </div>
              }
            >
              {filteredBrands.map((brand) => {
                const imageUrl = getBrandImageUrl(brand.image);

                return (
                  <TableRow
                    key={brand.id}
                    className="hover:bg-default-50/60 transition-colors bg-background"
                  >
                    {/* Marca: Logo Avatar + Nombre */}
                    <TableCell className="py-1 px-2.5">
                      <div className="flex items-center gap-2.5 py-0.5">
                        {imageUrl ? (
                          <Avatar
                            src={imageUrl}
                            alt={brand.name}
                            radius="md"
                            className="w-8 h-8 shrink-0 bg-default-100 object-cover border border-divider/40"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-default-100 dark:bg-default-200/40 text-default-600 flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                            {brand.name ? brand.name.slice(0, 2) : <LuTag size={14} />}
                          </div>
                        )}

                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-default-900 truncate max-w-[200px] sm:max-w-[320px]">
                            {brand.name}
                          </span>
                          <span className="text-[10px] text-default-400 font-mono">
                            ID: #{brand.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Slug */}
                    <TableCell className="py-1 px-2.5">
                      <Chip
                        size="sm"
                        variant="flat"
                        color="default"
                        className="text-[10px] font-mono h-5 px-1.5"
                      >
                        {brand.slug}
                      </Chip>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="py-1 px-2.5">
                      <div className="flex items-center justify-end gap-0.5 min-w-[95px]">
                        <Tooltip content="Ver detalles">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="h-7 w-7 min-w-7 text-default-500 hover:text-primary rounded-md"
                            onPress={() => setBrandToView(brand)}
                            aria-label="Ver marca"
                          >
                            <LuEye size={15} />
                          </Button>
                        </Tooltip>

                        {canUpdate && (
                          <Tooltip content="Editar marca">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="h-7 w-7 min-w-7 text-default-500 hover:text-warning rounded-md"
                              onPress={() => handleOpenEditModal(brand)}
                              aria-label="Editar marca"
                            >
                              <LuPencil size={14} />
                            </Button>
                          </Tooltip>
                        )}

                        {canDelete && (
                          <Tooltip content="Eliminar marca" color="danger">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              className="h-7 w-7 min-w-7 text-default-400 hover:text-danger rounded-md"
                              onPress={() => setBrandToDelete(brand)}
                              aria-label="Eliminar marca"
                            >
                              <LuTrash2 size={14} />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Brand Create & Edit Modal */}
      {isModalOpen && (
        <BrandModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={selectedBrand}
          isEditing={isEditing}
        />
      )}

      {/* Brand Excel Import / Export Modal */}
      {isExcelModalOpen && (
        <BrandExcelModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          totalBrands={brands.length}
        />
      )}

      {/* Quick Detail View Modal */}
      {brandToView && (
        <Modal
          isOpen={Boolean(brandToView)}
          onClose={() => setBrandToView(null)}
          size="sm"
          backdrop="blur"
          placement="center"
          classNames={{
            base: "border-none shadow-2xl rounded-3xl bg-background",
            header: "border-b border-divider/40 px-5 py-3.5",
            body: "px-5 py-4",
            footer: "border-t border-divider/40 px-5 py-3",
          }}
        >
          <ModalContent>
            {() => {
              const img = getBrandImageUrl(brandToView.image);

              return (
                <>
                  <ModalHeader className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/40 text-primary">
                      <LuTag size={18} />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="text-base font-bold text-default-900 leading-tight">
                        Detalle de Marca
                      </h3>
                      <span className="text-[11px] text-default-400 font-mono">
                        ID: #{brandToView.id}
                      </span>
                    </div>
                  </ModalHeader>
                  <ModalBody className="flex flex-col gap-3 text-xs">
                    {img && (
                      <div className="flex items-center justify-center p-4 rounded-2xl bg-default-50 border border-divider/40">
                        <img
                          src={img}
                          alt={brandToView.name}
                          className="max-h-36 max-w-full object-contain rounded-lg"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1 p-3 rounded-2xl bg-default-100/50">
                      <span className="text-[11px] font-semibold text-default-400 uppercase">
                        Nombre Comercial
                      </span>
                      <span className="text-sm font-bold text-default-900">
                        {brandToView.name}
                      </span>
                      <span className="text-[11px] text-default-400 font-mono">
                        slug: {brandToView.slug}
                      </span>
                    </div>
                  </ModalBody>
                  <ModalFooter>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => setBrandToView(null)}
                      className="text-xs font-medium"
                    >
                      Cerrar
                    </Button>
                  </ModalFooter>
                </>
              );
            }}
          </ModalContent>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {brandToDelete && (
        <Modal
          isOpen={Boolean(brandToDelete)}
          onClose={() => setBrandToDelete(null)}
          size="sm"
          backdrop="blur"
          placement="center"
          classNames={{
            base: "border-none shadow-2xl rounded-3xl bg-background",
            header: "border-b border-divider/40 px-5 py-3.5",
            body: "px-5 py-4",
            footer: "border-t border-divider/40 px-5 py-3",
          }}
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex items-center gap-2 text-danger">
                  <LuAlertTriangle size={20} />
                  <span className="text-base font-bold">¿Eliminar Marca?</span>
                </ModalHeader>
                <ModalBody className="flex flex-col gap-2">
                  <p className="text-xs text-default-600">
                    ¿Estás seguro de que deseas eliminar la marca{" "}
                    <strong className="text-default-900 font-bold">
                      "{brandToDelete.name}"
                    </strong>
                    ?
                  </p>
                  <p className="text-[11px] text-default-400">
                    Esta acción no se puede deshacer. Los productos asociados podrían perder su referencia de marca.
                  </p>
                </ModalBody>
                <ModalFooter className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setBrandToDelete(null)}
                    isDisabled={isDeleting}
                    className="text-xs font-medium"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="solid"
                    isLoading={isDeleting}
                    startContent={!isDeleting && <LuTrash2 size={14} />}
                    onPress={handleConfirmDelete}
                    className="text-xs font-semibold px-3 shadow-sm"
                  >
                    Sí, Eliminar
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}

      {/* Delete All Brands Confirmation Modal */}
      <Modal
        isOpen={isDeleteAllOpen}
        onClose={() => !isDeletingAll && setIsDeleteAllOpen(false)}
        placement="center"
        size="md"
        backdrop="blur"
        classNames={{
          base: "border border-danger-200 dark:border-danger-900/30 rounded-2xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2.5 text-danger border-b border-default-100 py-3">
                <LuAlertTriangle size={20} />
                <h3 className="text-base font-bold text-default-900">Eliminar Todas las Marcas</h3>
              </ModalHeader>
              <ModalBody className="py-4 flex flex-col gap-2">
                <p className="text-sm text-default-700">
                  ¿Estás seguro de que deseas eliminar las{" "}
                  <strong className="text-danger font-bold">{brands.length} marcas</strong> registradas?
                </p>
                <p className="text-xs text-default-500">
                  Esta acción desvinculará la marca de todos los productos existentes y eliminará de forma permanente todos los registros e imágenes de marcas. Esta acción no se puede deshacer.
                </p>
              </ModalBody>
              <ModalFooter className="border-t border-default-100 py-2.5">
                <Button size="sm" variant="light" onPress={onClose} isDisabled={isDeletingAll} radius="lg">
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  onPress={handleConfirmDeleteAll}
                  isLoading={isDeletingAll}
                  radius="lg"
                  className="font-semibold shadow-sm"
                >
                  Sí, eliminar todas
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
