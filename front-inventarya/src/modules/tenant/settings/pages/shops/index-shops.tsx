import { useEffect, useMemo, useState } from "react";
import { DynamicBreadcrumbs } from "@/components";
import { useNavigate } from "react-router-dom";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Tooltip,
  Input,
  Card,
  CardBody,
  CardFooter,
  ButtonGroup,
  Divider,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
} from "@nextui-org/react";
import {
  LuShoppingBag,
  LuCopy,
  LuCheck,
  LuStore,
  LuUsers,
  LuMapPin,
  LuPhone,
  LuPlus,
  LuSearch,
  LuLayoutGrid,
  LuTable,
  LuEye,
  LuPencil,
  LuTrash2,
  LuSatellite,
  LuAlertTriangle,
  LuKey,
  LuMoreVertical,
  LuEraser,
} from "react-icons/lu";
import { toast } from "sonner";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { getImageUrl } from "@/utils";
import { ShopModal } from "./components/ShopModal";
import { StoreApiConfigModal } from "./components/StoreApiConfigModal";

export const IndexShops = () => {
  const token = useTenantAuthStore((state) => state.token);
  const can = useTenantAuthStore((state) => state.can);
  const user = useTenantAuthStore((state) => state.user);
  const hasRole = useTenantAuthStore((state) => state.hasRole);
  const isOwner = hasRole("owner") || user?.role === "owner";
  const isAdmin = isOwner || hasRole("admin") || user?.role === "admin";
  const isStaff = !isAdmin;

  const [selectedRowData, setSelectedRowData] = useState<Record<string, any> | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Store API Config Modal (Exclusivo Dueño / Owner)
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [selectedShopForApi, setSelectedShopForApi] = useState<any | null>(null);

  // Success Modal when new shop is created
  const [createdStore, setCreatedStore] = useState<any | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [shopToDelete, setShopToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Clear POS Inventory Modal
  const [isClearPosModalOpen, setIsClearPosModalOpen] = useState<boolean>(false);
  const [shopToClearPos, setShopToClearPos] = useState<any | null>(null);
  const [isClearingPos, setIsClearingPos] = useState<boolean>(false);

  // View Mode & Pagination
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [tablePage, setTablePage] = useState<number>(1);
  const rowsPerPage = 10;

  const shops = useShopsStore((state) => state.shops);
  const getShops = useShopsStore((state) => state.getShops);
  const addShop = useShopsStore((state) => state.addShop);
  const deleteShop = useShopsStore((state) => state.deleteShop);
  const updateShop = useShopsStore((state) => state.updateShop);
  const clearStorePosInventory = useShopsStore((state) => state.clearStorePosInventory);

  const navigate = useNavigate();

  const handleFetchShops = async () => {
    if (shops.length === 0) {
      await getShops(token!);
    }
  };

  useEffect(() => {
    handleFetchShops();
  }, []);

  // Si el personal de ventas tiene una única tienda asignada, redirigir automáticamente al POS
  useEffect(() => {
    if (isStaff && shops.length === 1 && shops[0]?.slug) {
      navigate(`/tienda/${shops[0].slug}`, { replace: true });
    }
  }, [isStaff, shops, navigate]);

  const canCreate = can("stores:create");
  const canUpdate = can("stores:update");
  const canDelete = can("stores:delete");

  // Reset pagination when filter changes
  useEffect(() => {
    setTablePage(1);
  }, [searchQuery, statusFilter]);

  // Filtered Shops
  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        shop.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.phone?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && shop.is_active !== false) ||
        (statusFilter === "inactive" && shop.is_active === false);

      return matchSearch && matchStatus;
    });
  }, [shops, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredShops.length / rowsPerPage) || 1;
  const paginatedShops = useMemo(() => {
    const start = (tablePage - 1) * rowsPerPage;
    return filteredShops.slice(start, start + rowsPerPage);
  }, [filteredShops, tablePage]);

  const headers = [
    { name: "IMAGEN", uid: "front_image" },
    { name: "NOMBRE", uid: "name" },
    { name: "DIRECCION", uid: "address" },
    { name: "TELEFONO", uid: "phone" },
    { name: "ESTADO", uid: "is_active" },
    { name: "VENTA (POS)", uid: "pos_link" },
    ...(isAdmin ? [{ name: "ACCIONES", uid: canDelete ? "actions" : "actions-se" }] : []),
  ];

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (isEditing && selectedRowData?.id) {
      const success = await updateShop(formData, selectedRowData.id, token!);
      return success;
    } else {
      const created = await addShop(formData, token!);
      if (created && created.slug) {
        setCreatedStore(created);
        setIsSuccessModalOpen(true);
      }
      return Boolean(created);
    }
  };

  const handleNewShopClick = () => {
    setSelectedRowData({ is_active: true });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEditClick = (rowData: Record<string, any>) => {
    setSelectedRowData({
      ...rowData,
      is_active: rowData.is_active !== undefined ? Boolean(rowData.is_active) : true,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (id: string | number) => {
    const target = shops.find((s) => s.id === id);
    setShopToDelete(target || { id, name: `Tienda #${id}` });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!shopToDelete) return;
    setIsDeleting(true);
    try {
      await deleteShop(shopToDelete.id, token!);
      setIsDeleteModalOpen(false);
      setShopToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewClick = (id: string | number) => {
    navigate(`/shops/${id}`);
  };

  const handleCopyLink = (slug: string, id: number | string) => {
    if (!slug) return;
    const fullUrl = `${window.location.origin}/tienda/${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    toast.success("Enlace de ventas copiado al portapapeles");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenApiModal = (shop: any) => {
    setSelectedShopForApi(shop);
    setIsApiModalOpen(true);
  };

  const handleClearPosClick = (shop: any) => {
    setShopToClearPos(shop);
    setIsClearPosModalOpen(true);
  };

  const handleConfirmClearPos = async () => {
    if (!shopToClearPos) return;
    setIsClearingPos(true);
    try {
      const res = await clearStorePosInventory(shopToClearPos.id);
      if (res.success) {
        setIsClearPosModalOpen(false);
        setShopToClearPos(null);
      }
    } finally {
      setIsClearingPos(false);
    }
  };

  const getActionItems = (shop: any) => {
    const items: Array<{
      key: string;
      label: string;
      icon: React.ReactNode;
      color?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
      className?: string;
      action: () => void;
    }> = [
      {
        key: "pos",
        label: "Abrir Punto de Venta (POS)",
        icon: <LuShoppingBag size={15} className="text-emerald-600" />,
        action: () => window.open(`/tienda/${shop.slug}`, "_blank"),
      },
      {
        key: "view",
        label: "Ver detalles",
        icon: <LuEye size={15} className="text-default-500" />,
        action: () => handleViewClick(shop.id),
      },
    ];

    if (canUpdate) {
      items.push({
        key: "edit",
        label: "Editar tienda",
        icon: <LuPencil size={15} className="text-primary" />,
        action: () => handleEditClick(shop),
      });
    }

    if (isOwner) {
      items.push({
        key: "api",
        label: "Configurar API externa",
        icon: <LuKey size={15} className="text-amber-500" />,
        action: () => handleOpenApiModal(shop),
      });
    }

    if (isAdmin) {
      items.push({
        key: "clear-pos",
        label: "Vaciar todos los productos del POS",
        icon: <LuEraser size={15} className="text-warning-600 dark:text-warning-500" />,
        color: "warning",
        className: "text-warning-600 dark:text-warning-500 font-medium",
        action: () => handleClearPosClick(shop),
      });
    }

    if (canDelete) {
      items.push({
        key: "delete",
        label: "Eliminar tienda",
        icon: <LuTrash2 size={15} className="text-danger" />,
        color: "danger",
        className: "text-danger",
        action: () => handleDeleteClick(shop.id),
      });
    }

    return items;
  };

  const renderShopActionsDropdown = (shop: any) => {
    const actionItems = getActionItems(shop);
    return (
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            radius="lg"
            className="h-8 w-8 min-w-8 text-default-600 hover:text-default-900"
            aria-label="Acciones de tienda"
          >
            <LuMoreVertical size={16} />
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Acciones de tienda" items={actionItems}>
          {(item) => (
            <DropdownItem
              key={item.key}
              color={item.color || "default"}
              className={item.className || ""}
              startContent={item.icon}
              onPress={item.action}
            >
              {item.label}
            </DropdownItem>
          )}
        </DropdownMenu>
      </Dropdown>
    );
  };

  return (
    <>
      {/* Dedicated Professional Shop Modal with Satellite Location Picker */}
      <ShopModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        initialData={selectedRowData}
        isEditing={isEditing}
      />

      {/* Success Modal when store is created */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        backdrop="blur"
        placement="center"
        size="lg"
        classNames={{
          base: "bg-content1 shadow-xl rounded-xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="py-2 px-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-success">
                  <LuStore size={20} />
                  <span className="text-base sm:text-lg font-bold text-foreground">¡Tienda creada exitosamente!</span>
                </div>
                <p className="text-xs text-default-500 font-normal">
                  Se ha habilitado el lugar de venta y terminal POS para la tienda.
                </p>
              </ModalHeader>
              <Divider />

              <ModalBody className="py-2 px-3 flex flex-col gap-2">
                <div className="p-2 rounded-xl bg-default-100/70 dark:bg-default-100/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-default-500">Lugar de Venta (POS)</span>
                    <Chip size="sm" color="success" variant="flat" className="font-semibold h-5">
                      Habilitado
                    </Chip>
                  </div>

                  <div className="flex items-center gap-1.5 bg-background p-2 rounded-lg">
                    <span className="text-xs font-mono text-primary font-medium truncate flex-1 select-all">
                      {window.location.origin}/tienda/{createdStore?.slug}
                    </span>
                    <Tooltip content={copiedId === "modal" ? "¡Copiado!" : "Copiar enlace"}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="h-7 w-7 min-w-7"
                        onPress={() => handleCopyLink(createdStore?.slug, "modal")}
                      >
                        {copiedId === "modal" ? <LuCheck size={14} className="text-success" /> : <LuCopy size={14} />}
                      </Button>
                    </Tooltip>
                  </div>

                  <div className="text-xs text-default-500 flex items-center gap-1.5">
                    <LuUsers size={13} className="text-secondary" />
                    <span>El personal de ventas asignado a esta tienda tiene acceso a este punto de venta.</span>
                  </div>
                </div>
              </ModalBody>
              <Divider />

              <ModalFooter className="py-1.5 px-3 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    onClose();
                    if (createdStore?.id) navigate(`/shops/${createdStore.id}`);
                  }}
                >
                  Ver detalles
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  startContent={<LuShoppingBag size={15} />}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                  onPress={() => {
                    onClose();
                    window.open(`/tienda/${createdStore?.slug}`, "_blank");
                  }}
                >
                  Abrir Punto de Venta
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        size="sm"
        backdrop="blur"
        placement="center"
        classNames={{
          base: "bg-content1 shadow-xl rounded-xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="py-2 px-3 flex items-center gap-2 text-danger">
                <LuAlertTriangle size={18} />
                <span className="text-sm font-bold">¿Eliminar Tienda?</span>
              </ModalHeader>
              <Divider />

              <ModalBody className="py-2 px-3 flex flex-col gap-2">
                <p className="text-xs sm:text-sm text-default-600">
                  Estás a punto de eliminar definitivamente la tienda{" "}
                  <strong className="text-foreground font-bold">
                    {shopToDelete?.name}
                  </strong>
                  . Esta acción borrará sus asignaciones de personal y fachada física.
                </p>

                {shopToDelete && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-danger-50/40 text-xs text-danger-700 dark:text-danger-400">
                    <div className="w-8 h-8 rounded-lg bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center shrink-0">
                      <LuStore size={16} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs text-foreground truncate">{shopToDelete.name}</span>
                      <span className="text-[11px] truncate">{shopToDelete.address || "Sin dirección física"}</span>
                    </div>
                  </div>
                )}
              </ModalBody>
              <Divider />

              <ModalFooter className="py-1.5 px-3 flex items-center justify-end gap-1.5">
                <Button size="sm" variant="flat" onPress={onClose} isDisabled={isDeleting}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="solid"
                  isLoading={isDeleting}
                  startContent={!isDeleting && <LuTrash2 size={14} />}
                  onPress={handleConfirmDelete}
                  className="font-bold text-xs"
                >
                  Sí, Eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal Confirmación: Vaciar todos los productos del POS */}
      <Modal
        isOpen={isClearPosModalOpen}
        onClose={() => !isClearingPos && setIsClearPosModalOpen(false)}
        size="md"
        backdrop="blur"
        placement="center"
        classNames={{
          base: "bg-content1 shadow-xl rounded-xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="py-2.5 px-3 flex items-center gap-2 text-warning-600 dark:text-warning-500">
                <LuEraser size={20} />
                <span className="text-sm sm:text-base font-bold text-foreground">
                  ¿Vaciar todos los productos del POS?
                </span>
              </ModalHeader>
              <Divider />

              <ModalBody className="py-3 px-3 flex flex-col gap-3">
                <div className="text-xs sm:text-sm text-default-600 flex flex-col gap-2">
                  <p>
                    Estás a punto de vaciar y eliminar <strong className="text-foreground">todos los productos</strong> registrados en el terminal POS de la tienda{" "}
                    <strong className="text-foreground font-bold">{shopToClearPos?.name}</strong>.
                  </p>
                  <p className="text-warning-700 dark:text-warning-400 bg-warning-50/60 dark:bg-warning-900/20 p-2.5 rounded-lg border border-warning-200/50 text-xs">
                    ⚠️ <strong>Atención:</strong> Esta acción borrará todos los registros de inventario asignados a esta sucursal en la tabla <code className="font-mono bg-default-200/50 px-1 py-0.5 rounded">inventory_stores</code>. Los productos en el almacén central no se verán afectados.
                  </p>
                </div>

                {shopToClearPos && (
                  <div className="flex items-center gap-2.5 p-2 rounded-xl bg-default-100/70 text-xs">
                    <div className="w-9 h-9 rounded-lg bg-warning-100 dark:bg-warning-900/30 text-warning-600 flex items-center justify-center shrink-0">
                      <LuStore size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs text-foreground truncate">{shopToClearPos.name}</span>
                      <span className="text-[11px] text-default-500 truncate">{shopToClearPos.address || "Sin dirección física"}</span>
                      <span className="text-[10px] font-mono text-primary truncate">/tienda/{shopToClearPos.slug}</span>
                    </div>
                  </div>
                )}
              </ModalBody>
              <Divider />

              <ModalFooter className="py-2 px-3 flex items-center justify-end gap-2">
                <Button size="sm" variant="flat" onPress={onClose} isDisabled={isClearingPos}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="warning"
                  variant="solid"
                  isLoading={isClearingPos}
                  startContent={!isClearingPos && <LuEraser size={15} />}
                  onPress={handleConfirmClearPos}
                  className="font-bold text-xs text-white bg-warning-600 hover:bg-warning-700"
                >
                  Vaciar todos los productos del POS
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <div className="my-1 px-2 max-w-[95rem] mx-auto w-full flex flex-col gap-2 pb-6">
        {isAdmin && <DynamicBreadcrumbs title="Tiendas" />}

        {/* Banner amigable para Personal de Tienda / Staff */}
        {isStaff && (
          <div className="bg-primary-500/10 rounded-xl p-2 flex items-center justify-between gap-2 shadow-none">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm shrink-0">
                <LuStore />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-foreground">
                  Hola, <span className="text-primary">{user?.name}</span>
                </h2>
                <p className="text-[11px] text-default-500">
                  Selecciona la sucursal donde deseas operar la caja registradora y realizar ventas.
                </p>
              </div>
            </div>
            <Chip size="sm" color="primary" variant="flat" className="font-semibold text-xs h-5 hidden sm:flex">
              Punto de Venta
            </Chip>
          </div>
        )}

        {/* Toolbar: Sin header redundante, sin contador, limpio y compacto */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <Input
              isClearable
              placeholder="Buscar por nombre, dirección o coordenadas..."
              startContent={<LuSearch className="text-default-400" size={15} />}
              value={searchQuery}
              onValueChange={setSearchQuery}
              onClear={() => setSearchQuery("")}
              size="sm"
              radius="lg"
              variant="flat"
              className="w-full sm:max-w-xs"
            />

            <ButtonGroup size="sm" variant="flat">
              <Button
                color={statusFilter === "all" ? "primary" : "default"}
                variant={statusFilter === "all" ? "solid" : "light"}
                onPress={() => setStatusFilter("all")}
                className="text-xs h-8"
              >
                Todas
              </Button>
              <Button
                color={statusFilter === "active" ? "success" : "default"}
                variant={statusFilter === "active" ? "solid" : "light"}
                onPress={() => setStatusFilter("active")}
                className="text-xs h-8"
              >
                Activas
              </Button>
              <Button
                color={statusFilter === "inactive" ? "danger" : "default"}
                variant={statusFilter === "inactive" ? "solid" : "light"}
                onPress={() => setStatusFilter("inactive")}
                className="text-xs h-8"
              >
                Inactivas
              </Button>
            </ButtonGroup>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {/* Toggle View: Cards vs Table */}
            <ButtonGroup size="sm" variant="flat">
              <Button
                color={viewMode === "cards" ? "primary" : "default"}
                variant={viewMode === "cards" ? "solid" : "light"}
                startContent={<LuLayoutGrid size={14} />}
                onPress={() => setViewMode("cards")}
                className="text-xs h-8"
              >
                Cards
              </Button>
              <Button
                color={viewMode === "table" ? "primary" : "default"}
                variant={viewMode === "table" ? "solid" : "light"}
                startContent={<LuTable size={14} />}
                onPress={() => setViewMode("table")}
                className="text-xs h-8"
              >
                Tabla
              </Button>
            </ButtonGroup>

            {/* Create Button */}
            {canCreate && (
              <Button
                color="primary"
                variant="solid"
                size="sm"
                radius="lg"
                startContent={<LuPlus size={15} />}
                onPress={handleNewShopClick}
                className="font-semibold text-xs px-2.5 h-8 shadow-sm"
              >
                Nueva Tienda
              </Button>
            )}
          </div>
        </div>

        <Divider className="my-0.5" />

        {/* Card View Layout */}
        {viewMode === "cards" ? (
          filteredShops.length === 0 ? (
            <div className="p-4 text-center flex flex-col items-center justify-center gap-2 rounded-xl bg-default-50/50 my-2">
              <div className="p-3 rounded-full bg-default-100 text-default-400">
                <LuStore size={36} />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-default-800">No se encontraron tiendas</h3>
              <p className="text-xs text-default-400 max-w-md">
                {searchQuery
                  ? "No existen tiendas que coincidan con los filtros de búsqueda aplicados."
                  : "Aún no has registrado sucursales. Empieza creando tu primera tienda física con su ubicación en el mapa."}
              </p>
              {canCreate && !searchQuery && (
                <Button
                  color="primary"
                  variant="flat"
                  size="sm"
                  startContent={<LuPlus size={15} />}
                  onPress={handleNewShopClick}
                  className="mt-1 font-medium text-xs"
                >
                  Crear primera tienda
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filteredShops.map((shop) => {
                const isActive = shop.is_active !== false;
                const imageUrl = shop.front_image ? getImageUrl(shop.front_image) : null;
                const isCopied = copiedId === shop.id;

                return (
                  <Card
                    key={shop.id}
                    isHoverable
                    className="group shadow-none bg-content1 rounded-xl overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-md"
                  >
                    {/* Image / Header Cover */}
                    <div className="relative w-full h-36 sm:h-40 bg-default-100 overflow-hidden">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={shop.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-100/80 via-default-100 to-secondary-100/60 flex flex-col items-center justify-center text-default-400">
                          <LuStore size={40} className="opacity-40 group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-medium mt-1 text-default-400">Sin imagen</span>
                        </div>
                      )}

                      {/* Status and ID Badges Overlay */}
                      <div className="absolute top-2 inset-x-2 flex items-center justify-between pointer-events-none">
                        <Chip
                          size="sm"
                          color={isActive ? "success" : "danger"}
                          variant="solid"
                          className="font-semibold text-[10px] capitalize shadow-xs h-5 px-1.5"
                        >
                          {isActive ? "Activa" : "Inactiva"}
                        </Chip>
                        <div className="flex items-center gap-1">
                          {shop.api_status && (
                            <Chip
                              size="sm"
                              variant="flat"
                              className="bg-emerald-600/90 text-white font-mono text-[9px] font-bold backdrop-blur-md shadow-xs h-5"
                            >
                              API ON
                            </Chip>
                          )}
                        </div>
                      </div>

                      {/* Overlay gradient at bottom of image */}
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                      <span className="absolute bottom-1.5 left-2 text-[10px] font-mono text-white/90 drop-shadow-sm truncate max-w-[90%]">
                        slug: {shop.slug}
                      </span>
                    </div>

                    <Divider />

                    {/* Card Body */}
                    <CardBody className="p-2 flex flex-col gap-1.5">
                      <div>
                        <h2
                          onClick={() => handleViewClick(shop.id)}
                          className="font-bold text-sm sm:text-base text-default-900 line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                          title={shop.name}
                        >
                          {shop.name}
                        </h2>
                      </div>

                      {/* Location & Contact */}
                      <div className="flex flex-col gap-1 text-xs text-default-600">
                        <div className="flex items-start gap-1.5">
                          <LuMapPin size={14} className="text-primary mt-0.5 shrink-0" />
                          <span className="line-clamp-2 text-xs" title={shop.address || "Sin dirección"}>
                            {shop.address || "Sin dirección física"}
                          </span>
                        </div>

                        {shop.location && (
                          <div className="flex items-center gap-1.5 text-primary font-mono text-[10px]">
                            <LuSatellite size={13} className="text-primary shrink-0" />
                            <span className="truncate" title={shop.location}>
                              {shop.location}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          <LuPhone size={14} className="text-secondary shrink-0" />
                          <span className="text-xs">{shop.phone || "Sin teléfono"}</span>
                        </div>
                      </div>

                      {/* POS Quick Link Bar */}
                      <div className="mt-0.5 p-1.5 rounded-lg bg-default-100/70 flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 overflow-hidden">
                          <LuShoppingBag size={13} className="text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-mono text-default-600 truncate">
                            /tienda/{shop.slug}
                          </span>
                        </div>
                        <Tooltip content={isCopied ? "¡Copiado!" : "Copiar enlace POS"}>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="h-6 w-6 min-w-6 text-default-500"
                            onPress={() => handleCopyLink(shop.slug, shop.id)}
                          >
                            {isCopied ? <LuCheck size={13} className="text-success" /> : <LuCopy size={13} />}
                          </Button>
                        </Tooltip>
                      </div>
                    </CardBody>

                    <Divider />

                    {/* Card Footer: Action Buttons */}
                    <CardFooter className="px-2 py-1.5 bg-default-50/50 flex items-center justify-between gap-1.5">
                      <Button
                        color="primary"
                        size="sm"
                        variant="solid"
                        radius="lg"
                        startContent={<LuShoppingBag size={15} />}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm flex-1 h-8"
                        onPress={() => navigate(`/tienda/${shop.slug}`)}
                      >
                        POS
                      </Button>

                      {isAdmin && (
                        <div className="flex items-center">
                          {renderShopActionsDropdown(shop)}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          /* Table View Layout */
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-divider/60 bg-content1 overflow-hidden shadow-xs">
              <Table
                aria-label="Tabla de tiendas y sucursales"
                removeWrapper
                className="min-w-full"
              >
                <TableHeader>
                  <TableColumn className="bg-default-100 text-default-700 text-[11px] font-bold uppercase py-3 px-3">
                    IMAGEN
                  </TableColumn>
                  <TableColumn className="bg-default-100 text-default-700 text-[11px] font-bold uppercase py-3 px-3">
                    NOMBRE
                  </TableColumn>
                  <TableColumn className="bg-default-100 text-default-700 text-[11px] font-bold uppercase py-3 px-3">
                    DIRECCIÓN
                  </TableColumn>
                  <TableColumn className="bg-default-100 text-default-700 text-[11px] font-bold uppercase py-3 px-3">
                    TELÉFONO
                  </TableColumn>
                  <TableColumn className="bg-default-100 text-default-700 text-[11px] font-bold uppercase py-3 px-3 text-center">
                    ESTADO
                  </TableColumn>
                  <TableColumn className="bg-default-100 text-default-700 text-[11px] font-bold uppercase py-3 px-3">
                    VENTA (POS)
                  </TableColumn>
                  <TableColumn className="bg-default-100 text-default-700 text-[11px] font-bold uppercase py-3 px-3 text-right">
                    ACCIONES
                  </TableColumn>
                </TableHeader>
                <TableBody
                  emptyContent={
                    <div className="py-8 text-center text-xs text-default-400">
                      No se encontraron tiendas registradas
                    </div>
                  }
                >
                  {paginatedShops.map((shop) => {
                    const isActive = shop.is_active !== false;
                    const imageUrl = shop.front_image ? getImageUrl(shop.front_image) : null;
                    const isCopied = copiedId === shop.id;

                    return (
                      <TableRow
                        key={shop.id}
                        className="border-b border-divider/40 hover:bg-default-50/70 transition-colors"
                      >
                        <TableCell className="py-2 px-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-default-100 flex items-center justify-center shrink-0 border border-divider/40">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={shop.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <LuStore size={18} className="text-default-400" />
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-3">
                          <div className="flex flex-col">
                            <span
                              onClick={() => handleViewClick(shop.id)}
                              className="font-bold text-xs sm:text-sm text-foreground hover:text-primary cursor-pointer transition-colors"
                            >
                              {shop.name}
                            </span>
                            <span className="text-[11px] font-mono text-default-400">
                              slug: {shop.slug}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-3">
                          <div className="flex flex-col text-xs text-default-600 max-w-xs">
                            <div className="flex items-center gap-1">
                              <LuMapPin size={13} className="text-primary shrink-0" />
                              <span className="truncate">{shop.address || "Sin dirección física"}</span>
                            </div>
                            {shop.location && (
                              <span className="text-[10px] text-default-400 font-mono pl-4 truncate">
                                {shop.location}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-3">
                          <div className="flex items-center gap-1 text-xs text-default-600">
                            <LuPhone size={13} className="text-secondary shrink-0" />
                            <span>{shop.phone || "Sin teléfono"}</span>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Chip
                              size="sm"
                              variant="flat"
                              color={isActive ? "success" : "danger"}
                              className="font-semibold text-xs h-6"
                            >
                              {isActive ? "Activa" : "Inactiva"}
                            </Chip>
                            {shop.api_status && (
                              <Chip
                                size="sm"
                                variant="flat"
                                className="bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 font-mono text-[10px] font-bold h-6"
                              >
                                API
                              </Chip>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              startContent={<LuShoppingBag size={14} />}
                              className="font-medium text-xs h-7"
                              onPress={() => window.open(`/tienda/${shop.slug}`, "_blank")}
                            >
                              Lugar de Venta
                            </Button>
                            <Tooltip content={isCopied ? "¡Copiado!" : "Copiar enlace POS"}>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                className="h-7 w-7 min-w-7 text-default-500"
                                onPress={() => handleCopyLink(shop.slug, shop.id)}
                              >
                                {isCopied ? <LuCheck size={13} className="text-success" /> : <LuCopy size={13} />}
                              </Button>
                            </Tooltip>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end">
                            {renderShopActionsDropdown(shop)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Paginación de Tabla */}
            {totalPages > 1 && (
              <div className="flex justify-center my-2">
                <Pagination
                  isCompact
                  showControls
                  showShadow
                  color="primary"
                  page={tablePage}
                  total={totalPages}
                  onChange={setTablePage}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Configuración de API Externa de Productos (Solo Dueño / Owner) */}
      <StoreApiConfigModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        store={selectedShopForApi}
      />
    </>
  );
};
