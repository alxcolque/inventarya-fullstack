import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DynamicBreadcrumbs } from "@/components";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Select,
  SelectItem,
  Chip,
  Avatar,
  Divider,
  Tooltip,
  Skeleton,
} from "@nextui-org/react";
import {
  LuStore,
  LuUsers,
  LuUserPlus,
  LuMapPin,
  LuPhone,
  LuExternalLink,
  LuArrowLeft,
  LuWarehouse,
  LuCopy,
  LuCheck,
  LuTrash2,
  LuShieldAlert,
  LuShoppingBag,
  LuPencil,
  LuKey,
} from "react-icons/lu";
import { toast } from "sonner";
import { getImageUrl } from "@/utils";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";
import { useUsersStore } from "@/modules/tenant/users/store/users/users.store";
import { useAssignmentsStore } from "@/modules/tenant/pos/store/shops/assignments.store";
import { SatelliteLocationPicker } from "./components/SatelliteLocationPicker";
import { ShopModal } from "./components/ShopModal";
import { StoreApiConfigModal } from "./components/StoreApiConfigModal";

export const ShowShops = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const token = useTenantAuthStore((state) => state.token);
  const can = useTenantAuthStore((state) => state.can);
  const user = useTenantAuthStore((state) => state.user);
  const hasRole = useTenantAuthStore((state) => state.hasRole);
  const isOwner = hasRole("owner") || user?.role === "owner";

  const shop = useShopsStore((state) => state.shop);
  const getShop = useShopsStore((state) => state.getShop);
  const updateShop = useShopsStore((state) => state.updateShop);
  const users = useUsersStore((state) => state.users);
  const getUsers = useUsersStore((state) => state.getUsers);

  const getAssignments = useAssignmentsStore((state) => state.getAssignments);
  const assignments = useAssignmentsStore((state) => state.assignments);
  const deleteAssignment = useAssignmentsStore((state) => state.deleteAssignment);
  const addAssignment = useAssignmentsStore((state) => state.addAssignment);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState<boolean>(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const canManageAssignments = can("assignments:manage");
  const canUpdate = can("stores:update");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      if (id) {
        await Promise.all([
          getShop(id),
          getUsers(),
          getAssignments(id),
        ]);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [id]);

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    if (!selectedUserId) {
      toast.error("Por favor seleccione un trabajador");
      return;
    }

    try {
      setIsAssigning(true);
      await addAssignment({
        user_id: Number(selectedUserId),
        store_id: id,
      });
      setSelectedUserId("");
    } catch (err: any) {
      toast.error(err?.message || "Error al asignar trabajador");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteWorker = async (assignmentId: number, workerName?: string) => {
    if (!id) return;
    if (confirm(`¿Está seguro de desvincular a "${workerName || 'este trabajador'}" de la tienda?`)) {
      await deleteAssignment(assignmentId, id);
    }
  };

  const handleCopyPosUrl = () => {
    if (!shop?.slug) return;
    const fullUrl = `${window.location.origin}/tienda/${shop.slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("Enlace del Punto de Venta copiado al portapapeles");
    setTimeout(() => setCopied(false), 2500);
  };

  // Filtrar solo los usuarios con rol 'staff' que no estén ya asignados a esta tienda
  const availableStaff = users.filter((u) => {
    const isStaff = u.role === "staff";
    const isAlreadyAssigned = assignments.some(
      (a) => a.name === u.name || a.email === u.email
    );
    return isStaff && !isAlreadyAssigned;
  });

  const handleEditSubmit = async (formData: Record<string, any>) => {
    if (!shop?.id) return false;
    const success = await updateShop(formData, shop.id, token!);
    if (success) {
      await getShop(shop.id);
      setIsEditModalOpen(false);
      return true;
    }
    return false;
  };

  const mapQuery = shop?.location?.trim() || shop?.address?.trim() || "";

  if (isLoading) {
    return (
      <div className="my-1 px-2 max-w-[95rem] mx-auto w-full flex flex-col gap-2 pb-6">
        <DynamicBreadcrumbs title="Detalle de Tienda" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <div className="flex gap-1.5">
            <Skeleton className="h-8 w-24 rounded-xl" />
            <Skeleton className="h-8 w-28 rounded-xl" />
          </div>
        </div>
        <Divider className="my-0.5" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <Divider className="my-0.5" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
          <div className="lg:col-span-7 flex flex-col gap-2">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
          <div className="lg:col-span-5 flex flex-col gap-2">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!shop || !shop.id) {
    return (
      <div className="my-4 px-2 max-w-[95rem] mx-auto w-full flex flex-col items-center justify-center min-h-[50vh] gap-2">
        <div className="p-4 rounded-xl bg-danger-50/50 text-danger flex flex-col items-center gap-2 max-w-sm text-center">
          <LuShieldAlert size={36} />
          <h2 className="text-base font-bold">Tienda no encontrada</h2>
          <p className="text-xs text-default-600">
            La tienda solicitada con identificador #{id} no existe o no tienes permisos para consultarla.
          </p>
          <Button
            color="primary"
            size="sm"
            variant="flat"
            startContent={<LuArrowLeft size={14} />}
            onPress={() => navigate("/shops")}
            className="mt-1 font-semibold text-xs h-8"
          >
            Volver al listado de tiendas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-1 px-2 max-w-[95rem] mx-auto w-full flex flex-col gap-2 pb-6">
      <DynamicBreadcrumbs title={shop?.name || "Detalle de Tienda"} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-xl bg-default-100/70">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            radius="lg"
            onPress={() => navigate("/shops")}
            aria-label="Volver a tiendas"
            className="h-8 w-8 min-w-8 text-default-600 hover:text-default-900 shrink-0"
          >
            <LuArrowLeft size={18} />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-default-900 truncate">
                {shop.name}
              </h1>
              <Chip
                size="sm"
                color="primary"
                variant="flat"
                className="font-semibold capitalize h-5 text-[10px] px-1"
              >
                #{shop.id}
              </Chip>
              <Chip
                size="sm"
                color={shop.is_active !== false ? "success" : "danger"}
                variant="dot"
                className="text-[10px] font-semibold capitalize h-5 px-1"
              >
                {shop.is_active !== false ? "Activa" : "Inactiva"}
              </Chip>
            </div>
            <p className="text-[11px] text-default-500 flex items-center gap-1 truncate">
              <span className="font-mono text-default-400">slug:</span>
              <span className="font-mono text-default-700">
                {shop.slug}
              </span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto shrink-0">
          {isOwner && (
            <Button
              color={shop.api_status ? "success" : "default"}
              variant="flat"
              size="sm"
              radius="lg"
              startContent={<LuKey size={14} />}
              onPress={() => setIsApiModalOpen(true)}
              className="h-8 text-xs font-semibold px-2.5"
            >
              {shop.api_status ? "API Activa" : "Configurar API"}
            </Button>
          )}

          {canUpdate && (
            <Button
              color="default"
              variant="flat"
              size="sm"
              radius="lg"
              startContent={<LuPencil size={14} />}
              onPress={() => setIsEditModalOpen(true)}
              className="h-8 text-xs font-semibold px-2.5"
            >
              Editar
            </Button>
          )}
          <Button
            color="primary"
            variant="solid"
            size="sm"
            radius="lg"
            startContent={<LuShoppingBag size={14} />}
            onPress={() => navigate(`/tienda/${shop.slug}`)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm h-8 px-2.5"
          >
            Terminal POS
          </Button>
          <Button
            color="primary"
            variant="flat"
            size="sm"
            radius="lg"
            startContent={<LuWarehouse size={14} />}
            onPress={() => navigate(`/inventories/${shop.slug}`)}
            className="h-8 text-xs font-semibold px-2.5"
          >
            Inventario
          </Button>
        </div>
      </div>

      <Divider className="my-0.5" />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Card className="shadow-none bg-content1 rounded-xl">
          <CardBody className="p-2 flex flex-row items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <LuStore size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-bold text-default-400">Sucursal</span>
              <span className="text-xs sm:text-sm font-bold text-default-900 truncate">
                {shop.name}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-none bg-content1 rounded-xl">
          <CardBody className="p-2 flex flex-row items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
              <LuUsers size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-bold text-default-400">Personal</span>
              <span className="text-xs sm:text-sm font-bold text-default-900">
                {assignments.length}{" "}
                <span className="text-[11px] font-normal text-default-500">
                  {assignments.length === 1 ? "asignado" : "asignados"}
                </span>
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-none bg-content1 rounded-xl">
          <CardBody className="p-2 flex flex-row items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <LuPhone size={18} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase font-bold text-default-400">Teléfono</span>
              <span className="text-xs sm:text-sm font-semibold text-default-800 truncate">
                {shop.phone || "No especificado"}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card className="shadow-none bg-content1 rounded-xl">
          <CardBody className="p-2 flex flex-row items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
              <LuExternalLink size={18} />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold text-default-400">Enlace POS</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[11px] font-mono text-default-600 truncate">
                  /tienda/{shop.slug}
                </span>
                <Tooltip content={copied ? "¡Copiado!" : "Copiar enlace POS"}>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    onPress={handleCopyPosUrl}
                    className="h-6 w-6 min-w-6 text-default-500"
                  >
                    {copied ? <LuCheck size={13} className="text-success" /> : <LuCopy size={13} />}
                  </Button>
                </Tooltip>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Divider className="my-0.5" />

      {/* Main Grid: Details & Staff (Left), Media & Location (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* Left Column (7 cols): Store Details + Staff Management */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          {/* Card: Información General */}
          <Card className="shadow-none bg-content1 rounded-xl">
            <CardHeader className="py-1.5 px-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-default-900 font-bold text-xs sm:text-sm">
                <LuStore className="text-primary" size={16} />
                <span>Datos de la Sucursal</span>
              </div>
              <Chip size="sm" variant="flat" color="default" className="h-5 text-[10px]">
                ID #{shop.id}
              </Chip>
            </CardHeader>
            <Divider />

            <CardBody className="p-2 flex flex-col gap-2 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-default-100/70 p-2 rounded-xl">
                  <span className="text-[10px] font-semibold uppercase text-default-400 block mb-0.5">
                    Nombre Oficial
                  </span>
                  <p className="font-semibold text-default-800 text-xs sm:text-sm">{shop.name}</p>
                </div>

                <div className="bg-default-100/70 p-2 rounded-xl">
                  <span className="text-[10px] font-semibold uppercase text-default-400 block mb-0.5">
                    Slug de Acceso
                  </span>
                  <p className="font-mono text-default-800 text-xs sm:text-sm">{shop.slug}</p>
                </div>
              </div>

              <div className="bg-default-100/70 p-2 rounded-xl flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <LuMapPin size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase text-default-400 block mb-0.5">
                    Dirección Física
                  </span>
                  <p className="text-default-800 font-medium text-xs">
                    {shop.address || "Dirección no especificada"}
                  </p>
                </div>
              </div>

              <div className="bg-default-100/70 p-2 rounded-xl flex items-start gap-2">
                <div className="w-7 h-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <LuPhone size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase text-default-400 block mb-0.5">
                    Contacto Telefónico
                  </span>
                  <p className="text-default-800 font-medium text-xs">
                    {shop.phone || "Sin teléfono registrado"}
                  </p>
                </div>
              </div>

              {shop.location && (
                <div className="bg-default-100/70 p-2 rounded-xl">
                  <span className="text-[10px] font-semibold uppercase text-default-400 block mb-0.5">
                    Coordenadas / Referencia
                  </span>
                  <p className="font-mono text-[11px] text-default-700">{shop.location}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Card: Personal Asignado (Workers) */}
          <Card className="shadow-none bg-content1 rounded-xl">
            <CardHeader className="py-1.5 px-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-default-900 font-bold text-xs sm:text-sm">
                <LuUsers className="text-secondary" size={16} />
                <span>Personal Asignado ({assignments.length})</span>
              </div>
              <span className="text-[11px] text-default-400 font-medium">
                Roles tipo Staff
              </span>
            </CardHeader>
            <Divider />

            <CardBody className="p-2 flex flex-col gap-2">
              {/* Formulario para asignar nuevo trabajador */}
              {canManageAssignments && (
                <form
                  onSubmit={handleAddWorker}
                  className="bg-default-100/70 p-2 rounded-xl flex flex-col gap-1.5"
                >
                  <label className="text-[10px] font-bold uppercase tracking-wider text-default-500">
                    Asignar Personal a la Tienda
                  </label>
                  <div className="flex flex-col sm:flex-row gap-1.5">
                    <Select
                      placeholder={
                        availableStaff.length === 0
                          ? "No hay personal staff disponible"
                          : "Seleccionar usuario con rol staff"
                      }
                      selectedKeys={selectedUserId ? [selectedUserId] : []}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      isDisabled={availableStaff.length === 0 || isAssigning}
                      size="sm"
                      radius="lg"
                      variant="flat"
                      className="flex-1"
                      aria-label="Seleccionar trabajador"
                    >
                      {availableStaff.map((user) => (
                        <SelectItem key={String(user.id)} textValue={`${user.name} (${user.email})`}>
                          <div className="flex items-center gap-2 py-0.5">
                            <Avatar name={user.name} size="sm" className="h-5 w-5 text-[10px]" />
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">{user.name}</span>
                              <span className="text-[10px] text-default-400">{user.email}</span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </Select>

                    <Button
                      type="submit"
                      color="secondary"
                      size="sm"
                      radius="lg"
                      isLoading={isAssigning}
                      isDisabled={!selectedUserId || availableStaff.length === 0}
                      startContent={!isAssigning && <LuUserPlus size={14} />}
                      className="font-semibold text-xs h-8 shadow-sm shrink-0"
                    >
                      Asignar
                    </Button>
                  </div>

                  {availableStaff.length === 0 && (
                    <p className="text-[11px] text-default-400 flex items-center gap-1 mt-0.5">
                      <span className="text-amber-500 font-bold">Nota:</span>
                      Solo personal con rol staff. Crear en{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/users")}
                        className="text-primary underline font-medium"
                      >
                        Usuarios
                      </button>
                      .
                    </p>
                  )}
                </form>
              )}

              {/* Lista de Trabajadores Asignados */}
              <div className="flex flex-col gap-1.5">
                {assignments.length === 0 ? (
                  <div className="p-4 text-center flex flex-col items-center justify-center gap-1 rounded-xl bg-default-50/50">
                    <LuUsers size={28} className="text-default-300" />
                    <p className="text-xs font-semibold text-default-700">
                      No hay trabajadores asignados a esta tienda
                    </p>
                    <p className="text-[11px] text-default-400 max-w-sm">
                      Asigna personal para operar el Punto de Venta en esta sucursal.
                    </p>
                  </div>
                ) : (
                  assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-default-50/80 hover:bg-default-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          name={assignment.name}
                          size="sm"
                          className="bg-primary-100 text-primary font-bold h-7 w-7 text-xs shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-default-900 text-xs truncate">
                            {assignment.name}
                          </span>
                          <span className="text-[10px] text-default-400 truncate">
                            {assignment.email || "Sin email"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Chip size="sm" variant="flat" color="secondary" className="capitalize text-[10px] font-semibold h-5 px-1.5">
                          {assignment.role || "Staff"}
                        </Chip>
                        {canManageAssignments && (
                          <Tooltip content="Desvincular de la tienda" color="danger">
                            <Button
                              isIconOnly
                              size="sm"
                              color="danger"
                              variant="light"
                              radius="lg"
                              className="h-7 w-7 min-w-7 text-default-500 hover:text-danger"
                              onPress={() => handleDeleteWorker(assignment.id, assignment.name)}
                              aria-label={`Eliminar a ${assignment.name}`}
                            >
                              <LuTrash2 size={14} />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column (5 cols): Facade Image + Interactive Map */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          {/* Card: Fachada de la Tienda */}
          <Card className="shadow-none bg-content1 rounded-xl overflow-hidden">
            <CardHeader className="py-1.5 px-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-default-900 font-bold text-xs sm:text-sm">
                <LuStore className="text-primary" size={16} />
                <span>Fachada de la Tienda</span>
              </div>
              <span className="text-[11px] text-default-400 font-medium">
                Imagen pública
              </span>
            </CardHeader>
            <Divider />

            <CardBody className="p-2 flex flex-col items-center justify-center">
              {shop.front_image ? (
                <div className="w-full relative rounded-xl overflow-hidden shadow-inner group">
                  <img
                    src={getImageUrl(shop.front_image)}
                    alt={`Fachada de ${shop.name}`}
                    className="w-full h-44 sm:h-48 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 text-white">
                    <p className="font-bold text-xs sm:text-sm drop-shadow-sm truncate">{shop.name}</p>
                    <p className="text-[10px] text-white/80 drop-shadow-sm truncate">{shop.address}</p>
                  </div>
                </div>
              ) : (
                <div className="w-full h-36 rounded-xl bg-default-100/50 flex flex-col items-center justify-center gap-1 text-default-400">
                  <LuStore size={28} className="text-default-300" />
                  <span className="text-xs font-medium">Sin imagen de fachada</span>
                  <span className="text-[10px] text-default-400">Sube una imagen al editar la tienda</span>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Card: Ubicación y Mapa Satelital */}
          <Card className="shadow-none bg-content1 rounded-xl overflow-hidden">
            <CardHeader className="py-1.5 px-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-default-900 font-bold text-xs sm:text-sm">
                <LuMapPin className="text-danger" size={16} />
                <span>Ubicación Satelital</span>
              </div>
              {mapQuery && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(mapQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                >
                  Abrir mapa <LuExternalLink size={12} />
                </a>
              )}
            </CardHeader>
            <Divider />

            <CardBody className="p-2 flex flex-col gap-2">
              {shop.location ? (
                <div className="w-full rounded-xl overflow-hidden shadow-none">
                  <SatelliteLocationPicker
                    value={shop.location}
                    readOnly
                    height="240px"
                  />
                </div>
              ) : shop.address ? (
                <div className="w-full rounded-xl overflow-hidden shadow-none">
                  <iframe
                    title={`Mapa de ubicación de ${shop.name}`}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(shop.address)}&z=15&output=embed`}
                    width="100%"
                    height="240"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="p-4 text-center flex flex-col items-center justify-center gap-1 rounded-xl bg-default-50/50">
                  <LuMapPin size={24} className="text-default-300" />
                  <p className="text-xs font-medium text-default-500">
                    Sin coordenadas registradas para mapa satelital.
                  </p>
                </div>
              )}
              <div className="px-1 text-[11px] text-default-500 flex items-center gap-1.5">
                <LuMapPin size={13} className="text-default-400 shrink-0" />
                <span className="truncate">{shop.address || "Sin dirección física registrada"}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Edit Shop Modal */}
      {isEditModalOpen && (
        <ShopModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleEditSubmit}
          initialData={shop}
          isEditing={true}
        />
      )}

      {/* Store API Config Modal (Exclusivo Dueño / Owner) */}
      <StoreApiConfigModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        store={shop}
      />
    </div>
  );
};
