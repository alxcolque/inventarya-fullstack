import { useEffect, useMemo, useRef, useState } from "react";
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
  Avatar,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Card,
  Tooltip,
  Skeleton,
  Divider,
} from "@nextui-org/react";
import {
  LuSearch,
  LuPlus,
  LuUser,
  LuUsers,
  LuShield,
  LuCrown,
  LuUserCheck,
  LuMail,
  LuPhone,
  LuCreditCard,
  LuEye,
  LuEyeOff,
  LuPencil,
  LuTrash2,
  LuCamera,
  LuRefreshCw,
  LuCheck,
  LuX,
  LuLock,
  LuAlertTriangle,
  LuFingerprint,
  LuSend,
} from "react-icons/lu";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useUsersStore, UserFormData } from "../../store/users/users.store";
import { IUsersResponse, UserRole, UserStatus } from "../../interfaces/users/users-response";
import { toast } from "sonner";

export const IndexUsers = () => {
  const currentUser = useTenantAuthStore((state) => state.user);
  const can = useTenantAuthStore((state) => state.can);

  const canCreate = can("users:create") || currentUser?.role === "owner";
  const canDelete = can("users:delete") || currentUser?.role === "owner";
  const canUpdate = can("users:update") || currentUser?.role === "owner";

  const isCurrentOwner = currentUser?.role === "owner";

  // Zustand Store
  const users = useUsersStore((state) => state.users);
  const isLoading = useUsersStore((state) => state.isLoading);
  const isSaving = useUsersStore((state) => state.isSaving);
  const getUsers = useUsersStore((state) => state.getUsers);
  const createUser = useUsersStore((state) => state.createUser);
  const updateUser = useUsersStore((state) => state.updateUser);
  const deleteUser = useUsersStore((state) => state.deleteUser);
  const updateRole = useUsersStore((state) => state.updateRole);
  const resendInvitation = useUsersStore((state) => state.resendInvitation);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<IUsersResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    email: "",
    username: "",
    role: "staff",
    status: "pending_activation",
    phone: "",
    ci: "",
    password: "",
    avatar: null,
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        searchTerm.trim() === "" ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.phone && u.phone.includes(searchTerm)) ||
        (u.ci && u.ci.includes(searchTerm));

      const matchRole =
        selectedRoleFilter === "all" || u.role === selectedRoleFilter;

      const matchStatus =
        selectedStatusFilter === "all" || u.status === selectedStatusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, selectedRoleFilter, selectedStatusFilter]);

  // Metrics
  const stats = useMemo(() => {
    const total = users.length;
    const owners = users.filter((u) => u.role === "owner").length;
    const admins = users.filter((u) => u.role === "admin").length;
    const staff = users.filter((u) => u.role === "staff").length;
    const active = users.filter((u) => u.status === "active").length;
    return { total, owners, admins, staff, active };
  }, [users]);

  // Handle Form Open for Create
  const handleOpenCreate = () => {
    setSelectedUser(null);
    setIsEditing(false);
    setFormData({
      name: "",
      email: "",
      username: "",
      role: "staff",
      status: "pending_activation",
      phone: "",
      ci: "",
      password: "",
      avatar: null,
    });
    setAvatarPreview(null);
    setShowPassword(false);
    setIsFormModalOpen(true);
  };

  // Handle Form Open for Edit
  const handleOpenEdit = (user: IUsersResponse) => {
    setSelectedUser(user);
    setIsEditing(true);
    setFormData({
      name: user.name,
      email: user.email,
      username: user.username || "",
      role: user.role,
      status: user.status,
      phone: user.phone || "",
      ci: user.ci || "",
      password: "",
      avatar: user.avatar || null,
    });
    setAvatarPreview(user.avatar || null);
    setShowPassword(false);
    setIsFormModalOpen(true);
  };

  // Handle Detail Open
  const handleOpenDetail = (user: IUsersResponse) => {
    setSelectedUser(user);
    setIsDetailModalOpen(true);
  };

  // Handle Delete Click
  const handleOpenDelete = (user: IUsersResponse) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  // Handle Avatar file change
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no debe superar los 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      setFormData((prev) => ({ ...prev, avatar: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setFormData((prev) => ({ ...prev, avatar: "delete" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre completo es requerido");
      return;
    }
    if (!formData.email.trim()) {
      toast.error("El correo electrónico es requerido");
      return;
    }

    if (!isEditing) {
      const success = await createUser({
        name: formData.name,
        email: formData.email,
        username: formData.username || null,
        role: formData.role,
        phone: formData.phone || null,
        ci: formData.ci || null,
        avatar: formData.avatar,
      });
      if (success) {
        setIsFormModalOpen(false);
      }
    } else if (selectedUser) {
      const payload: Partial<UserFormData> = {
        name: formData.name,
        email: formData.email,
        username: formData.username || null,
        role: formData.role,
        phone: formData.phone || null,
        ci: formData.ci || null,
        avatar: formData.avatar,
      };

      if (formData.status !== "pending_activation") {
        payload.status = formData.status;
      }

      if (formData.password && formData.password.trim() !== "") {
        if (formData.password.length < 6) {
          toast.error("La contraseña debe tener al menos 6 caracteres");
          return;
        }
        payload.password = formData.password;
      }

      const success = await updateUser(selectedUser.id, payload);
      if (success) {
        setIsFormModalOpen(false);
      }
    }
  };

  // Quick Toggle Status
  const handleToggleStatus = async (user: IUsersResponse) => {
    if (!canUpdate) {
      toast.error("No tienes permisos para modificar el estado de usuarios");
      return;
    }

    if (user.status === "pending_activation") {
      toast.info("La cuenta se activará cuando el usuario defina su contraseña.");
      return;
    }

    if (user.role === "owner" && user.status === "active") {
      const otherActiveOwners = users.filter(
        (u) => u.role === "owner" && u.status === "active" && u.id !== user.id
      ).length;
      if (otherActiveOwners === 0) {
        toast.error("No se puede desactivar al único propietario activo de la tienda");
        return;
      }
    }

    const nextStatus: UserStatus = user.status === "active" ? "inactive" : "active";
    await updateRole(user.id, { status: nextStatus });
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    const success = await deleteUser(selectedUser.id);
    if (success) {
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
    }
  };

  const handleResendInvitation = async (user: IUsersResponse) => {
    await resendInvitation(user.id);
  };

  // User Initials helper
  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Role chip render
  const renderRoleChip = (role: UserRole) => {
    switch (role) {
      case "owner":
        return (
          <Chip
            size="sm"
            color="warning"
            variant="flat"
            startContent={<LuCrown size={13} className="ml-1" />}
            className="font-medium capitalize text-[11px]"
          >
            Propietario
          </Chip>
        );
      case "admin":
        return (
          <Chip
            size="sm"
            color="primary"
            variant="flat"
            startContent={<LuShield size={13} className="ml-1" />}
            className="font-medium capitalize text-[11px]"
          >
            Administrador
          </Chip>
        );
      case "staff":
      default:
        return (
          <Chip
            size="sm"
            color="secondary"
            variant="flat"
            startContent={<LuUserCheck size={13} className="ml-1" />}
            className="font-medium capitalize text-[11px]"
          >
            Personal (Staff)
          </Chip>
        );
    }
  };

  return (
    <div className="my-1 px-2 max-w-[95rem] mx-auto w-full flex flex-col gap-2 pb-6">
      {/* Breadcrumbs */}
      <DynamicBreadcrumbs title="Usuarios" />

      {/* Top Bar: Contador de usuarios y botón pequeño Nuevo Usuario */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Chip
            size="sm"
            color="primary"
            variant="flat"
            startContent={<LuUsers size={13} className="ml-1" />}
            className="font-semibold text-xs h-6"
          >
            {users.length} {users.length === 1 ? "usuario" : "usuarios"}
          </Chip>
        </div>

        {canCreate && (
          <Button
            color="primary"
            variant="solid"
            size="sm"
            radius="lg"
            startContent={<LuPlus size={14} />}
            onPress={handleOpenCreate}
            className="font-semibold text-xs h-8 px-2.5 shadow-sm"
          >
            Nuevo Usuario
          </Button>
        )}
      </div>

      <Divider className="my-0.5" />

      {/* Toolbar: Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Search input */}
        <Input
          isClearable
          placeholder="Buscar por nombre, usuario, email, CI o teléfono..."
          startContent={<LuSearch className="text-default-400" size={15} />}
          value={searchTerm}
          onValueChange={setSearchTerm}
          onClear={() => setSearchTerm("")}
          size="sm"
          radius="lg"
          variant="flat"
          className="w-full sm:max-w-xs"
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
          <Select
            size="sm"
            radius="lg"
            variant="flat"
            className="w-32 sm:w-36"
            selectedKeys={[selectedRoleFilter]}
            onChange={(e) => setSelectedRoleFilter(e.target.value || "all")}
            aria-label="Filtrar por rol"
          >
            <SelectItem key="all">Todos los roles</SelectItem>
            <SelectItem key="owner">Propietarios</SelectItem>
            <SelectItem key="admin">Administradores</SelectItem>
            <SelectItem key="staff">Personal Staff</SelectItem>
          </Select>

          <Select
            size="sm"
            radius="lg"
            variant="flat"
            className="w-28 sm:w-32"
            selectedKeys={[selectedStatusFilter]}
            onChange={(e) => setSelectedStatusFilter(e.target.value || "all")}
            aria-label="Filtrar por estado"
          >
            <SelectItem key="all">Todos</SelectItem>
            <SelectItem key="active">Activos</SelectItem>
            <SelectItem key="inactive">Inactivos</SelectItem>
            <SelectItem key="pending_activation">Pendientes</SelectItem>
          </Select>

          <Tooltip content="Recargar usuarios">
            <Button
              isIconOnly
              size="sm"
              radius="lg"
              variant="flat"
              onPress={() => getUsers()}
              isLoading={isLoading}
              className="h-8 w-8 min-w-8"
              aria-label="Recargar"
            >
              <LuRefreshCw size={14} />
            </Button>
          </Tooltip>
        </div>
      </div>

      <Divider className="my-0.5" />

      {/* Users Table: Responsive with horizontal scroll for mobile */}
      <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table
            aria-label="Tabla de usuarios del sistema"
            isStriped
            removeWrapper
            className="min-w-[640px] w-full"
          >
            <TableHeader>
              <TableColumn className="text-[10px] font-bold uppercase tracking-wider py-2 px-2">
                USUARIO
              </TableColumn>
              <TableColumn className="text-[10px] font-bold uppercase tracking-wider py-2 px-2">
                ROL DE ACCESO
              </TableColumn>
              <TableColumn className="text-[10px] font-bold uppercase tracking-wider py-2 px-2">
                CONTACTO
              </TableColumn>
              <TableColumn className="text-[10px] font-bold uppercase tracking-wider py-2 px-2">
                ESTADO
              </TableColumn>
              <TableColumn align="end" className="text-[10px] font-bold uppercase tracking-wider py-2 px-2 text-right">
                ACCIONES
              </TableColumn>
            </TableHeader>
            <TableBody
              isLoading={isLoading}
              loadingContent={
                <div className="py-8 flex flex-col items-center gap-2">
                  <Skeleton className="rounded-lg w-full h-12" />
                  <Skeleton className="rounded-lg w-full h-12" />
                  <Skeleton className="rounded-lg w-full h-12" />
                </div>
              }
              emptyContent={
                <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                  <div className="p-4 rounded-full bg-default-100 text-default-400">
                    <LuUsers size={32} />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-foreground">
                      No se encontraron usuarios
                    </h4>
                    <p className="text-xs text-default-400 mt-0.5">
                      {searchTerm || selectedRoleFilter !== "all" || selectedStatusFilter !== "all"
                        ? "Intenta ajustar los filtros de búsqueda."
                        : "Comienza registrando un nuevo usuario en el sistema."}
                    </p>
                  </div>
                  {(searchTerm || selectedRoleFilter !== "all" || selectedStatusFilter !== "all") && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      onPress={() => {
                        setSearchTerm("");
                        setSelectedRoleFilter("all");
                        setSelectedStatusFilter("all");
                      }}
                    >
                      Limpiar Filtros
                    </Button>
                  )}
                </div>
              }
            >
              {filteredUsers.map((user) => {
                const isCurrentUser = currentUser?.id === user.id;
                const isLastOwner = user.role === "owner" && stats.owners <= 1;
                const isPending = user.status === "pending_activation";

                return (
                  <TableRow key={user.id} className="hover:bg-default-50/50 transition-colors">
                    {/* Usuario (Avatar + Nombre + Username) */}
                    <TableCell className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <Avatar
                          src={user.avatar || undefined}
                          showFallback
                          fallback={
                            user.avatar ? (
                              <LuUser size={18} className="text-default-400" />
                            ) : (
                              <span className="text-[11px] sm:text-xs font-semibold text-primary">
                                {getInitials(user.name)}
                              </span>
                            )
                          }
                          size="sm"
                          className="ring-1 ring-divider/30 bg-primary-50 dark:bg-primary-950/40 shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs sm:text-sm text-foreground truncate max-w-[150px] sm:max-w-[200px]">
                              {user.name}
                            </span>
                            {isCurrentUser && (
                              <Chip size="sm" variant="dot" color="primary" className="h-4 text-[9px] px-1">
                                Tú
                              </Chip>
                            )}
                          </div>
                          <span className="text-[11px] text-default-400 truncate">
                            @{user.username || "usuario"}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Rol */}
                    <TableCell className="py-2.5 px-3">{renderRoleChip(user.role)}</TableCell>

                    {/* Contacto */}
                    <TableCell className="py-2.5 px-3">
                      <div className="flex flex-col gap-0.5 text-[11px] sm:text-xs">
                        <span className="flex items-center gap-1 text-foreground truncate max-w-[180px]">
                          <LuMail size={12} className="text-default-400 shrink-0" />
                          {user.email}
                        </span>
                        {user.phone ? (
                          <span className="flex items-center gap-1 text-default-500">
                            <LuPhone size={12} className="text-default-400 shrink-0" />
                            {user.phone}
                          </span>
                        ) : (
                          <span className="text-default-400 italic text-[10px]">Sin teléfono</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Estado */}
                    <TableCell className="py-2.5 px-3">
                      <Tooltip
                        content={
                          isPending
                            ? "Pendiente de que el usuario defina su contraseña"
                            : canUpdate
                            ? "Haz clic para alternar estado"
                            : "Estado de la cuenta"
                        }
                      >
                        <Chip
                          size="sm"
                          color={isPending ? "warning" : user.status === "active" ? "success" : "danger"}
                          variant="flat"
                          className={`text-[11px] font-medium ${canUpdate && !isPending ? "cursor-pointer hover:opacity-80" : ""}`}
                          onClick={() => canUpdate && !isPending && handleToggleStatus(user)}
                        >
                          {isPending ? "Pendiente de activación" : user.status === "active" ? "Activo" : "Inactivo"}
                        </Chip>
                      </Tooltip>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1 min-w-[105px]">
                        {/* View detail */}
                        <Tooltip content="Ver perfil detallado">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="h-7 w-7 min-w-7 text-default-500 hover:text-primary rounded-lg"
                            onPress={() => handleOpenDetail(user)}
                          >
                            <LuEye size={15} />
                          </Button>
                        </Tooltip>

                        {/* Edit */}
                        {canUpdate && (
                          <Tooltip content="Editar usuario">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="h-7 w-7 min-w-7 text-default-500 hover:text-warning rounded-lg"
                              onPress={() => handleOpenEdit(user)}
                            >
                              <LuPencil size={15} />
                            </Button>
                          </Tooltip>
                        )}

                        {canCreate && isPending && (
                          <Tooltip content="Invalidar el enlace anterior y enviar uno nuevo">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="primary"
                              className="h-7 w-7 min-w-7 rounded-lg"
                              isLoading={isSaving}
                              onPress={() => handleResendInvitation(user)}
                              aria-label="Reenviar invitación"
                            >
                              <LuSend size={15} />
                            </Button>
                          </Tooltip>
                        )}

                        {/* Delete */}
                        {canDelete && (
                          <Tooltip
                            content={
                              isCurrentUser
                                ? "No puedes eliminar tu propia cuenta"
                                : isLastOwner
                                  ? "No se puede eliminar al único propietario"
                                  : "Eliminar usuario"
                            }
                            color={isCurrentUser || isLastOwner ? "default" : "danger"}
                          >
                            <span>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                className="h-7 w-7 min-w-7 text-default-400 hover:text-danger rounded-lg"
                                isDisabled={isCurrentUser || isLastOwner}
                                onPress={() => handleOpenDelete(user)}
                              >
                                <LuTrash2 size={15} />
                              </Button>
                            </span>
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

      {/* ======================================================== */}
      {/* MODAL: Crear / Editar Usuario                            */}
      {/* ======================================================== */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        size="2xl"
        backdrop="blur"
        scrollBehavior="inside"
        placement="center"
        classNames={{
          wrapper: "items-center p-2",
          base: "m-0 w-full max-h-[90vh] bg-content1 rounded-xl shadow-xl overflow-hidden my-auto",
        }}
      >
        <ModalContent className="overflow-hidden">
          {(onClose) => (
            <form
              onSubmit={handleSubmitForm}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <ModalHeader className="shrink-0 flex flex-col gap-0.5 px-3 py-2 sm:px-4">
                <h3 className="text-sm sm:text-base font-bold flex items-center gap-1.5 text-foreground leading-tight">
                  {isEditing
                    ? <LuPencil className="shrink-0 text-warning" size={16} />
                    : <LuPlus className="shrink-0 text-primary" size={16} />}
                  <span className="min-w-0 truncate">
                    {isEditing ? `Editar Usuario: ${selectedUser?.name}` : "Invitar nuevo usuario"}
                  </span>
                </h3>
                <p className="text-[11px] text-default-500 font-normal">
                  {isEditing
                    ? "Actualiza los datos del usuario, credenciales y rol de seguridad."
                    : "Crearemos una cuenta pendiente y enviaremos un enlace seguro para que defina su contraseña."}
                </p>
              </ModalHeader>
              <Divider />

              <ModalBody className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 flex flex-col gap-2">
                {!isEditing && (
                  <div className="shrink-0 flex items-start gap-2 rounded-xl bg-primary-50/60 p-2 text-xs">
                    <LuSend className="mt-0.5 shrink-0 text-primary" size={15} />
                    <div>
                      <p className="font-semibold text-primary-700">Activación segura por correo</p>
                      <p className="text-[11px] text-default-600 mt-0.5">
                        No debes asignar una contraseña. El usuario recibirá un enlace de un solo uso para crearla.
                      </p>
                    </div>
                  </div>
                )}
                {/* Avatar Section */}
                <div className="shrink-0 flex w-full min-w-0 flex-col sm:flex-row items-center gap-2 sm:gap-3 p-2 rounded-xl bg-default-100/70">
                  <div className="relative group shrink-0">
                    <Avatar
                      src={avatarPreview || undefined}
                      showFallback
                      fallback={
                        <LuUser size={26} className="text-default-400" />
                      }
                      className="w-14 h-14 text-base ring-2 ring-primary/20 bg-background"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <LuCamera size={18} />
                    </button>
                  </div>

                  <div className="flex min-w-0 flex-col items-center sm:items-start gap-1 flex-1 text-center sm:text-left">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        Fotografía de Perfil (Opcional)
                      </h4>
                      <p className="text-[11px] text-default-500">
                        Si no se proporciona imagen, se usará un avatar elegante con iniciales.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start mt-0.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="h-7 text-xs px-2.5"
                        startContent={<LuCamera size={13} />}
                        onPress={() => fileInputRef.current?.click()}
                      >
                        Subir Imagen
                      </Button>

                      {avatarPreview && (
                        <Button
                          type="button"
                          size="sm"
                          variant="light"
                          color="danger"
                          className="h-7 text-xs px-2"
                          startContent={<LuX size={13} />}
                          onPress={handleRemoveAvatar}
                        >
                          Quitar Foto
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Form Fields in 2 Columns */}
                <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Nombre Completo */}
                  <Input
                    isRequired
                    size="sm"
                    label="Nombre Completo"
                    placeholder="Juan Perez"
                    labelPlacement="outside"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    startContent={<LuUser className="text-default-400" size={15} />}
                  />

                  {/* Correo Electrónico */}
                  <Input
                    isRequired
                    type="email"
                    size="sm"
                    label="Correo Electrónico"
                    placeholder="user@mail.com"
                    labelPlacement="outside"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    startContent={<LuMail className="text-default-400" size={15} />}
                  />

                  {/* Nombre de Usuario (Opcional) */}
                  <Input
                    size="sm"
                    label="Nombre de Usuario"
                    placeholder="ej. jperez (opcional)"
                    labelPlacement="outside"
                    value={formData.username || ""}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    description="Opcional. Se autogenera si se deja vacío."
                    startContent={<span className="text-default-400 text-xs">@</span>}
                  />

                  {/* Rol de Acceso */}
                  <Select
                    isRequired
                    size="sm"
                    label="Rol de Acceso"
                    labelPlacement="outside"
                    selectedKeys={[formData.role]}
                    onChange={(e) => {
                      if (e.target.value) {
                        setFormData({ ...formData, role: e.target.value as UserRole });
                      }
                    }}
                    description={
                      !isCurrentOwner
                        ? "Solo los propietarios pueden asignar el rol Propietario."
                        : undefined
                    }
                  >
                    <SelectItem
                      key="owner"
                      textValue="Propietario (Owner)"
                      isDisabled={!isCurrentOwner || !isEditing}
                    >
                      <div className="flex items-center gap-1.5">
                        <LuCrown className="text-warning" size={14} />
                        <div>
                          <p className="font-semibold text-xs">Propietario (Owner)</p>
                          <p className="text-[10px] text-default-400">Acceso irrestricto y control total</p>
                        </div>
                      </div>
                    </SelectItem>

                    <SelectItem key="admin" textValue="Administrador (Admin)">
                      <div className="flex items-center gap-1.5">
                        <LuShield className="text-primary" size={14} />
                        <div>
                          <p className="font-semibold text-xs">Administrador (Admin)</p>
                          <p className="text-[10px] text-default-400">Gestión de catálogo, ventas e inventarios</p>
                        </div>
                      </div>
                    </SelectItem>

                    <SelectItem key="staff" textValue="Personal (Staff)">
                      <div className="flex items-center gap-1.5">
                        <LuUserCheck className="text-secondary" size={14} />
                        <div>
                          <p className="font-semibold text-xs">Personal (Staff)</p>
                          <p className="text-[10px] text-default-400">Operador de caja, POS y atención</p>
                        </div>
                      </div>
                    </SelectItem>
                  </Select>

                  {/* Cédula / CI */}
                  <Input
                    size="sm"
                    label="Cédula de Identidad (CI)"
                    placeholder="Ej. 8765432"
                    labelPlacement="outside"
                    value={formData.ci || ""}
                    onChange={(e) => setFormData({ ...formData, ci: e.target.value })}
                    startContent={<LuCreditCard className="text-default-400" size={15} />}
                  />

                  {/* Teléfono */}
                  <Input
                    size="sm"
                    label="Teléfono / Celular"
                    placeholder="Ej. +591 71234567"
                    labelPlacement="outside"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    startContent={<LuPhone className="text-default-400" size={15} />}
                  />

                  {isEditing && formData.status !== "pending_activation" && (
                    <>
                      {/* Estado */}
                      <Select
                        isRequired
                        size="sm"
                        label="Estado de la Cuenta"
                        labelPlacement="outside"
                        selectedKeys={[formData.status]}
                        onChange={(e) => {
                          if (e.target.value) {
                            setFormData({ ...formData, status: e.target.value as UserStatus });
                          }
                        }}
                      >
                        <SelectItem key="active" textValue="Activo">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-success"></span>
                            <span className="text-xs font-semibold">Activo (Habilitado)</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="inactive" textValue="Inactivo">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-danger"></span>
                            <span className="text-xs font-semibold">Inactivo (Bloqueado)</span>
                          </div>
                        </SelectItem>
                      </Select>

                      {/* Contraseña */}
                      <Input
                        size="sm"
                        type={showPassword ? "text" : "password"}
                        label="Nueva Contraseña (Opcional)"
                        placeholder="Dejar en blanco para mantener contraseña actual"
                        labelPlacement="outside"
                        value={formData.password || ""}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        description="Solo ingresa valor si deseas cambiar la contraseña del usuario."
                        startContent={<LuLock className="text-default-400" size={15} />}
                        endContent={
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="text-default-400 hover:text-default-600 transition-colors"
                          >
                            {showPassword ? <LuEyeOff size={15} /> : <LuEye size={15} />}
                          </button>
                        }
                      />
                    </>
                  )}

                  {isEditing && formData.status === "pending_activation" && (
                    <div className="sm:col-span-2 flex items-start gap-2 rounded-xl bg-warning-50/60 p-2 text-xs text-warning-800 dark:text-warning-300">
                      <LuAlertTriangle className="mt-0.5 shrink-0 text-warning" size={16} />
                      <div>
                        <p className="font-semibold">Cuenta pendiente de activación</p>
                        <p className="text-[11px] text-default-600 mt-0.5">
                          La contraseña y el estado sólo cambiarán cuando el usuario complete su invitación. Si corriges el correo, enviaremos un enlace nuevo e invalidaremos el anterior.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ModalBody>
              <Divider />

              <ModalFooter className="shrink-0 flex items-center justify-end gap-1.5 px-3 py-2 sm:px-4">
                <Button size="sm" variant="flat" className="h-8 text-xs px-3" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  color="primary"
                  className="h-8 text-xs px-3"
                  isLoading={isSaving}
                  startContent={!isSaving && <LuCheck size={15} />}
                >
                  {isEditing ? "Guardar Cambios" : "Crear y enviar invitación"}
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: Detalle de Usuario (View Profile)                 */}
      {/* ======================================================== */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        size="lg"
        backdrop="blur"
        placement="center"
        classNames={{
          wrapper: "items-center p-2",
          base: "m-0 w-full max-h-[90vh] bg-content1 rounded-xl shadow-xl overflow-hidden my-auto",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="shrink-0 flex items-center gap-1.5 px-3 py-2 sm:px-4 text-sm sm:text-base font-bold">
                <LuUser className="text-primary" size={16} />
                <span>Perfil de Usuario</span>
              </ModalHeader>
              <Divider />

              <ModalBody className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 flex flex-col gap-2">
                {selectedUser && (
                  <div className="flex flex-col gap-2">
                    {/* Header Banner with Avatar */}
                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-default-100/70">
                      <Avatar
                        src={selectedUser.avatar || undefined}
                        showFallback
                        fallback={
                          <span className="text-sm font-bold text-primary">
                            {getInitials(selectedUser.name)}
                          </span>
                        }
                        className="w-12 h-12 text-sm ring-2 ring-primary/20 shrink-0"
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {selectedUser.name}
                          </h4>
                          {renderRoleChip(selectedUser.role)}
                        </div>
                        <p className="text-[11px] text-default-400">
                          @{selectedUser.username || "usuario"}
                        </p>
                        <div className="mt-1">
                          <Chip
                            size="sm"
                            variant="dot"
                            className="h-5 text-[10px]"
                            color={selectedUser.status === "pending_activation" ? "warning" : selectedUser.status === "active" ? "success" : "danger"}
                          >
                            {selectedUser.status === "pending_activation"
                              ? "Pendiente de activación"
                              : selectedUser.status === "active"
                                ? "Cuenta Activa"
                                : "Cuenta Deshabilitada"}
                          </Chip>
                        </div>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col p-2 rounded-xl bg-default-100/70">
                        <span className="text-[11px] text-default-400 flex items-center gap-1 font-medium">
                          <LuMail size={13} className="text-primary" /> Correo Electrónico
                        </span>
                        <span className="font-semibold text-foreground mt-0.5 break-all">
                          {selectedUser.email}
                        </span>
                      </div>

                      <div className="flex flex-col p-2 rounded-xl bg-default-100/70">
                        <span className="text-[11px] text-default-400 flex items-center gap-1 font-medium">
                          <LuPhone size={13} className="text-primary" /> Teléfono
                        </span>
                        <span className="font-semibold text-foreground mt-0.5">
                          {selectedUser.phone || "No especificado"}
                        </span>
                      </div>

                      <div className="flex flex-col p-2 rounded-xl bg-default-100/70">
                        <span className="text-[11px] text-default-400 flex items-center gap-1 font-medium">
                          <LuCreditCard size={13} className="text-primary" /> Cédula de Identidad (CI)
                        </span>
                        <span className="font-semibold text-foreground mt-0.5">
                          {selectedUser.ci || "No especificado"}
                        </span>
                      </div>

                      <div className="flex flex-col p-2 rounded-xl bg-default-100/70">
                        <span className="text-[11px] text-default-400 flex items-center gap-1 font-medium">
                          <LuFingerprint size={13} className="text-primary" /> Identificador ID
                        </span>
                        <span className="font-semibold text-foreground mt-0.5 font-mono">
                          #{selectedUser.id}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </ModalBody>
              <Divider />

              <ModalFooter className="shrink-0 flex items-center justify-end gap-1.5 px-3 py-2 sm:px-4">
                <Button size="sm" variant="flat" className="h-8 text-xs px-3" onPress={onClose}>
                  Cerrar
                </Button>
                {canUpdate && selectedUser && (
                  <Button
                    size="sm"
                    color="primary"
                    className="h-8 text-xs px-3"
                    startContent={<LuPencil size={14} />}
                    onPress={() => {
                      onClose();
                      handleOpenEdit(selectedUser);
                    }}
                  >
                    Editar Usuario
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: Eliminar Usuario                                  */}
      {/* ======================================================== */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        size="md"
        backdrop="blur"
        placement="center"
        classNames={{
          wrapper: "items-center p-2",
          base: "m-0 w-full max-h-[90vh] bg-content1 rounded-xl shadow-xl overflow-hidden my-auto",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="shrink-0 flex items-center gap-1.5 px-3 py-2 sm:px-4 text-sm sm:text-base font-bold text-danger">
                <LuAlertTriangle size={18} />
                <span>¿Confirmar Eliminación?</span>
              </ModalHeader>
              <Divider />

              <ModalBody className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:p-3 flex flex-col gap-2">
                <p className="text-xs text-default-600">
                  Estás a punto de eliminar definitivamente al usuario{" "}
                  <strong className="text-foreground font-bold">
                    {selectedUser?.name}
                  </strong>{" "}
                  ({selectedUser?.email}). Esta acción es irreversible y revocaría todo acceso a la tienda.
                </p>

                {selectedUser && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-danger-50/40 text-danger-700 dark:text-danger-400">
                    <Avatar
                      src={selectedUser.avatar || undefined}
                      fallback={<LuUser size={16} />}
                      size="sm"
                      className="w-8 h-8"
                    />
                    <div className="flex flex-col text-xs">
                      <span className="font-bold">{selectedUser.name}</span>
                      <span className="text-[10px] opacity-80">Rol actual: {selectedUser.role.toUpperCase()}</span>
                    </div>
                  </div>
                )}
              </ModalBody>
              <Divider />

              <ModalFooter className="shrink-0 flex items-center justify-end gap-1.5 px-3 py-2 sm:px-4">
                <Button size="sm" variant="flat" className="h-8 text-xs px-3" onPress={onClose}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="solid"
                  className="h-8 text-xs px-3"
                  isLoading={isSaving}
                  startContent={!isSaving && <LuTrash2 size={14} />}
                  onPress={handleConfirmDelete}
                >
                  Sí, Eliminar Usuario
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
