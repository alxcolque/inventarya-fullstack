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
  Skeleton,
} from "@nextui-org/react";
import {
  LuUser,
  LuMail,
  LuPhone,
  LuCreditCard,
  LuCrown,
  LuShield,
  LuUserCheck,
  LuArrowLeft,
  LuCheck,
  LuFingerprint,
  LuCalendar,
} from "react-icons/lu";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useUsersStore } from "../../store/users/users.store";
import { UserRole, UserStatus } from "../../interfaces/users/users-response";
import { toast } from "sonner";

export const ShowUsers = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const currentUser = useTenantAuthStore((state) => state.user);
  const can = useTenantAuthStore((state) => state.can);

  const canUpdate = can("users:update") || currentUser?.role === "owner";
  const isOwner = currentUser?.role === "owner";

  const user = useUsersStore((state) => state.user);
  const isLoading = useUsersStore((state) => state.isLoading);
  const getUser = useUsersStore((state) => state.getUser);
  const updateRole = useUsersStore((state) => state.updateRole);

  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    if (id) {
      getUser(Number(id));
    }
  }, [id]);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role);
      setSelectedStatus(user.status);
    }
  }, [user]);

  const handleUpdateRoleAndStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

    if (!canUpdate) {
      toast.error("No tienes permisos para actualizar este usuario");
      return;
    }

    if (user.role === "owner" && selectedRole !== "owner") {
      if (!isOwner) {
        toast.error("Solo un propietario puede modificar a otro propietario");
        return;
      }
    }

    setIsUpdating(true);
    const success = await updateRole(Number(id), {
      role: selectedRole as UserRole,
      status: selectedStatus as UserStatus,
    });
    setIsUpdating(false);

    if (success) {
      getUser(Number(id));
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderRoleBadge = (role?: string) => {
    switch (role) {
      case "owner":
        return (
          <Chip
            size="sm"
            color="warning"
            variant="flat"
            startContent={<LuCrown size={14} className="ml-1" />}
            className="font-medium"
          >
            Propietario (Owner)
          </Chip>
        );
      case "admin":
        return (
          <Chip
            size="sm"
            color="primary"
            variant="flat"
            startContent={<LuShield size={14} className="ml-1" />}
            className="font-medium"
          >
            Administrador (Admin)
          </Chip>
        );
      case "staff":
      default:
        return (
          <Chip
            size="sm"
            color="secondary"
            variant="flat"
            startContent={<LuUserCheck size={14} className="ml-1" />}
            className="font-medium"
          >
            Personal (Staff)
          </Chip>
        );
    }
  };

  if (isLoading && !user) {
    return (
      <div className="my-1 px-2 max-w-5xl mx-auto w-full flex flex-col gap-2 pb-6">
        <DynamicBreadcrumbs title="Detalle de Usuario" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="my-1 px-2 max-w-5xl mx-auto w-full flex flex-col gap-2 pb-6">
      {/* Breadcrumbs */}
      <DynamicBreadcrumbs title={user?.name || "Detalle de Usuario"} />

      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="light"
          radius="lg"
          startContent={<LuArrowLeft size={16} />}
          onPress={() => navigate("/users")}
          className="font-medium text-xs h-8 text-default-600 hover:text-default-900"
        >
          Volver a Usuarios
        </Button>
      </div>

      <Divider className="my-0.5" />

      {/* Profile Header Card */}
      <Card className="shadow-none bg-content1 rounded-xl overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-primary-500/20 via-primary-500/10 to-transparent" />
        <CardBody className="px-3 pb-2 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 -mt-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-2 text-center sm:text-left">
              <Avatar
                src={user?.avatar || undefined}
                showFallback
                fallback={
                  <span className="text-base font-bold text-primary">
                    {getInitials(user?.name)}
                  </span>
                }
                className="w-14 h-14 ring-2 ring-background bg-primary-50 dark:bg-primary-950/40 shadow-sm shrink-0"
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap justify-center sm:justify-start">
                  <h2 className="text-base sm:text-lg font-bold text-foreground truncate">{user?.name}</h2>
                  {renderRoleBadge(user?.role)}
                </div>
                <p className="text-[11px] text-default-400">
                  @{user?.username || "usuario"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5">
              <Chip
                size="sm"
                variant="dot"
                color={user?.status === "active" ? "success" : "danger"}
                className="font-medium capitalize h-5 text-[10px] px-1"
              >
                {user?.status === "active" ? "Activo" : "Inactivo"}
              </Chip>
            </div>
          </div>
        </CardBody>
      </Card>

      <Divider className="my-0.5" />

      {/* Details & Settings Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Contact & Personal Info (2 Cols) */}
        <div className="md:col-span-2 flex flex-col gap-2">
          <Card className="shadow-none bg-content1 rounded-xl">
            <CardHeader className="py-1.5 px-3">
              <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-foreground">
                <LuUser className="text-primary" size={15} /> Información de Contacto e Identificación
              </h3>
            </CardHeader>
            <Divider />

            <CardBody className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col p-2 rounded-xl bg-default-100/70">
                <span className="text-[10px] text-default-400 flex items-center gap-1 font-medium">
                  <LuMail size={12} className="text-primary" /> Correo Electrónico
                </span>
                <span className="font-semibold text-foreground text-xs mt-0.5 break-all">
                  {user?.email}
                </span>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-default-100/70">
                <span className="text-[10px] text-default-400 flex items-center gap-1 font-medium">
                  <LuPhone size={12} className="text-primary" /> Teléfono / Celular
                </span>
                <span className="font-semibold text-foreground text-xs mt-0.5">
                  {user?.phone || "No especificado"}
                </span>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-default-100/70">
                <span className="text-[10px] text-default-400 flex items-center gap-1 font-medium">
                  <LuCreditCard size={12} className="text-primary" /> Cédula de Identidad (CI)
                </span>
                <span className="font-semibold text-foreground text-xs mt-0.5">
                  {user?.ci || "No especificado"}
                </span>
              </div>

              <div className="flex flex-col p-2 rounded-xl bg-default-100/70">
                <span className="text-[10px] text-default-400 flex items-center gap-1 font-medium">
                  <LuFingerprint size={12} className="text-primary" /> ID de Usuario
                </span>
                <span className="font-semibold text-foreground text-xs mt-0.5 font-mono">
                  #{user?.id}
                </span>
              </div>

              {user?.created_at && (
                <div className="sm:col-span-2 flex flex-col p-2 rounded-xl bg-default-100/70">
                  <span className="text-[10px] text-default-400 flex items-center gap-1 font-medium">
                    <LuCalendar size={12} className="text-primary" /> Fecha de Registro
                  </span>
                  <span className="font-medium text-foreground text-[11px] mt-0.5">
                    {new Date(user.created_at).toLocaleString("es-ES", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Role & Status Management (1 Col) */}
        <div className="md:col-span-1">
          <Card className="shadow-none bg-content1 rounded-xl h-full">
            <CardHeader className="py-1.5 px-3">
              <h3 className="text-xs sm:text-sm font-bold flex items-center gap-1.5 text-foreground">
                <LuShield className="text-primary" size={15} /> Rol y Estado
              </h3>
            </CardHeader>
            <Divider />

            <CardBody className="p-2">
              <form onSubmit={handleUpdateRoleAndStatus} className="flex flex-col gap-2">
                <Select
                  size="sm"
                  radius="lg"
                  variant="flat"
                  label="Rol Asignado"
                  labelPlacement="outside"
                  selectedKeys={selectedRole ? [selectedRole] : []}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  isDisabled={!canUpdate}
                  description={
                    !isOwner
                      ? "Solo el propietario puede otorgar rol Propietario"
                      : undefined
                  }
                >
                  <SelectItem key="owner" textValue="Propietario" isDisabled={!isOwner}>
                    <div className="flex items-center gap-1.5">
                      <LuCrown size={14} className="text-warning" />
                      <span className="text-xs font-semibold">Propietario (Owner)</span>
                    </div>
                  </SelectItem>
                  <SelectItem key="admin" textValue="Administrador">
                    <div className="flex items-center gap-1.5">
                      <LuShield size={14} className="text-primary" />
                      <span className="text-xs font-semibold">Administrador (Admin)</span>
                    </div>
                  </SelectItem>
                  <SelectItem key="staff" textValue="Personal Staff">
                    <div className="flex items-center gap-1.5">
                      <LuUserCheck size={14} className="text-secondary" />
                      <span className="text-xs font-semibold">Personal (Staff)</span>
                    </div>
                  </SelectItem>
                </Select>

                <Select
                  size="sm"
                  radius="lg"
                  variant="flat"
                  label="Estado de la Cuenta"
                  labelPlacement="outside"
                  selectedKeys={selectedStatus ? [selectedStatus] : []}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  isDisabled={!canUpdate}
                >
                  <SelectItem key="active" textValue="Activo">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                      <span className="text-xs font-semibold">Activo</span>
                    </div>
                  </SelectItem>
                  <SelectItem key="inactive" textValue="Inactivo">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>
                      <span className="text-xs font-semibold">Inactivo</span>
                    </div>
                  </SelectItem>
                </Select>

                <Divider className="my-0.5" />

                {canUpdate && (
                  <Button
                    type="submit"
                    color="primary"
                    variant="solid"
                    size="sm"
                    radius="lg"
                    isLoading={isUpdating}
                    startContent={!isUpdating && <LuCheck size={15} />}
                    className="w-full font-semibold text-xs h-8 shadow-sm"
                    isDisabled={
                      selectedRole === user?.role && selectedStatus === user?.status
                    }
                  >
                    Guardar Cambios
                  </Button>
                )}
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
