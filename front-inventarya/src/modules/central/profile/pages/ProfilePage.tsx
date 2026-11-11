import { useEffect, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Divider,
  Input,
  Skeleton,
} from "@nextui-org/react";
import {
  LuCamera,
  LuClock3,
  LuEye,
  LuEyeOff,
  LuKeyRound,
  LuMail,
  LuRefreshCw,
  LuSave,
  LuShieldCheck,
  LuTrash2,
  LuUser,
} from "react-icons/lu";
import { toast } from "sonner";
import { HeaderPage } from "@/components/ui/HeaderPage";
import { useCentralProfileStore } from "../store/profile.store";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const formatDate = (value: string | null): string => {
  if (!value) return "Sin registro";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const roleLabel = (role: string): string => {
  if (role === "superadmin") return "Superadministrador";
  if (role === "support") return "Soporte";
  return role;
};

export const ProfilePage = () => {
  const {
    profile,
    isLoading,
    isSaving,
    isChangingPassword,
    error,
    getProfile,
    updateProfile,
    changePassword,
  } = useCentralProfileStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarPayload, setAvatarPayload] = useState<string | null>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    void getProfile();
  }, [getProfile]);

  useEffect(() => {
    if (!profile) return;

    setName(profile.name);
    setEmail(profile.email);
    setAvatarPreview(profile.avatar);
    setAvatarPayload(undefined);
  }, [profile]);

  const hasProfileChanges = Boolean(
    profile &&
    (name.trim() !== profile.name ||
      email.trim().toLowerCase() !== profile.email ||
      avatarPayload !== undefined),
  );

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSaveProfile = name.trim().length >= 2 && isValidEmail && hasProfileChanges;
  const isValidPassword =
    currentPassword.length > 0 &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    password !== currentPassword &&
    password === passwordConfirmation;

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error("Formato no permitido", {
        description: "Selecciona una imagen JPG, PNG o WebP.",
      });
      return;
    }

    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("La imagen es demasiado grande", {
        description: "El avatar no debe superar los 2 MB.",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setAvatarPreview(result);
        setAvatarPayload(result);
      }
    };
    reader.onerror = () => toast.error("No se pudo leer la imagen seleccionada.");
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarPayload("delete");
  };

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSaveProfile) return;

    const updated = await updateProfile({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      ...(avatarPayload !== undefined ? { avatar: avatarPayload } : {}),
    });

    if (updated) setAvatarPayload(undefined);
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidPassword) return;

    const changed = await changePassword({
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
    });

    if (changed) {
      setCurrentPassword("");
      setPassword("");
      setPasswordConfirmation("");
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="flex flex-col gap-6">
        <HeaderPage title="Perfil" subtitle="Gestiona tu información personal y seguridad" />
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-80 rounded-2xl" />
          <div className="flex flex-col gap-6">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col gap-6">
        <HeaderPage title="Perfil" subtitle="Gestiona tu información personal y seguridad" />
        <Card className="border border-danger-200 bg-danger-50/40 shadow-sm">
          <CardBody className="items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-danger-100 p-4 text-danger">
              <LuUser size={28} />
            </div>
            <div>
              <p className="font-semibold">No pudimos cargar tu perfil</p>
              <p className="mt-1 text-sm text-default-500">{error}</p>
            </div>
            <Button
              color="primary"
              variant="flat"
              startContent={<LuRefreshCw size={18} />}
              onPress={() => void getProfile()}
            >
              Reintentar
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <HeaderPage
        title="Mi perfil"
        subtitle="Administra tu información personal y protege el acceso a tu cuenta"
      />

      <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="overflow-hidden border border-divider shadow-sm lg:sticky lg:top-6">
          <CardBody className="items-center px-6 pt-12 pb-6 text-center">
            <Avatar
              src={avatarPreview ?? undefined}
              name={name || profile.name}
              className="-mt-12 h-24 w-24 border-4 border-content1 bg-primary-100 text-2xl font-bold text-primary shadow-lg"
              showFallback
            />
            <h2 className="mt-4 break-words text-xl font-bold">{name || profile.name}</h2>
            <p className="mt-1 max-w-full break-all text-sm text-default-500">{email || profile.email}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Chip color={profile.role === "superadmin" ? "danger" : "warning"} variant="flat" size="sm">
                {roleLabel(profile.role)}
              </Chip>
              <Chip
                color={profile.status === "active" ? "success" : "default"}
                variant="dot"
                size="sm"
              >
                {profile.status === "active" ? "Cuenta activa" : profile.status}
              </Chip>
            </div>

            <Divider className="my-6" />

            <div className="w-full space-y-4 text-left">
              <div className="flex items-start gap-3">
                <LuClock3 className="mt-0.5 shrink-0 text-default-400" size={18} />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-default-400">Último acceso</p>
                  <p className="mt-0.5 text-sm text-default-700">{formatDate(profile.last_login_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <LuShieldCheck className="mt-0.5 shrink-0 text-default-400" size={18} />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-default-400">Miembro desde</p>
                  <p className="mt-0.5 text-sm text-default-700">{formatDate(profile.created_at)}</p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="border border-divider shadow-sm">
            <form onSubmit={handleProfileSubmit}>
              <CardHeader className="flex-col items-start gap-1 px-6 pt-6">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-primary-100 p-2 text-primary">
                    <LuUser size={20} />
                  </span>
                  <h2 className="text-lg font-semibold">Información personal</h2>
                </div>
                <p className="pl-11 text-sm text-default-500">Los datos visibles en tu sesión de Central.</p>
              </CardHeader>

              <CardBody className="gap-6 px-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <Avatar
                    src={avatarPreview ?? undefined}
                    name={name || profile.name}
                    className="h-20 w-20 shrink-0 bg-primary-100 text-xl font-semibold text-primary"
                    showFallback
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Fotografía de perfil</p>
                    <p className="mt-1 text-sm text-default-500">JPG, PNG o WebP. Tamaño máximo: 2 MB.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<LuCamera size={16} />}
                        onPress={() => fileInputRef.current?.click()}
                      >
                        Cambiar foto
                      </Button>
                      {avatarPreview && (
                        <Button
                          type="button"
                          size="sm"
                          color="danger"
                          variant="light"
                          startContent={<LuTrash2 size={16} />}
                          onPress={handleRemoveAvatar}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ALLOWED_AVATAR_TYPES.join(",")}
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                </div>

                <Divider />

                <div className="grid gap-5 md:grid-cols-2">
                  <Input
                    isRequired
                    label="Nombre completo"
                    labelPlacement="outside"
                    placeholder="Juan Perez"
                    value={name}
                    maxLength={100}
                    onValueChange={setName}
                    startContent={<LuUser className="text-default-400" size={18} />}
                    isInvalid={name.length > 0 && name.trim().length < 2}
                    errorMessage="Ingresa al menos 2 caracteres."
                  />
                  <Input
                    isRequired
                    type="email"
                    label="Correo electrónico"
                    labelPlacement="outside"
                    placeholder="user@mail.com"
                    value={email}
                    maxLength={150}
                    onValueChange={setEmail}
                    startContent={<LuMail className="text-default-400" size={18} />}
                    isInvalid={email.length > 0 && !isValidEmail}
                    errorMessage="Ingresa un correo electrónico válido."
                  />
                </div>
              </CardBody>

              <CardFooter className="justify-end border-t border-divider bg-default-50/50 px-6 py-4">
                <Button
                  type="submit"
                  color="primary"
                  isLoading={isSaving}
                  isDisabled={!canSaveProfile || isSaving}
                  startContent={!isSaving ? <LuSave size={18} /> : undefined}
                >
                  Guardar cambios
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="border border-divider shadow-sm">
            <form onSubmit={handlePasswordSubmit}>
              <CardHeader className="flex-col items-start gap-1 px-6 pt-6">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-warning-100 p-2 text-warning-600">
                    <LuKeyRound size={20} />
                  </span>
                  <h2 className="text-lg font-semibold">Seguridad</h2>
                </div>
                <p className="pl-11 text-sm text-default-500">
                  Al cambiarla, se cerrarán tus otras sesiones por seguridad.
                </p>
              </CardHeader>

              <CardBody className="gap-5 px-6">
                <Input
                  isRequired
                  type={showCurrentPassword ? "text" : "password"}
                  label="Contraseña actual"
                  labelPlacement="outside"
                  placeholder="Ingresa tu contraseña actual"
                  value={currentPassword}
                  onValueChange={setCurrentPassword}
                  endContent={
                    <button
                      type="button"
                      aria-label={showCurrentPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="text-default-400"
                      onClick={() => setShowCurrentPassword((value) => !value)}
                    >
                      {showCurrentPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                    </button>
                  }
                />

                <div className="grid gap-5 md:grid-cols-2">
                  <Input
                    isRequired
                    type={showPassword ? "text" : "password"}
                    label="Nueva contraseña"
                    labelPlacement="outside"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onValueChange={setPassword}
                    description="Debe incluir letras y números."
                    isInvalid={password.length > 0 && (!/[A-Za-z]/.test(password) || !/\d/.test(password) || password.length < 8)}
                    errorMessage="Usa al menos 8 caracteres, con letras y números."
                    endContent={
                      <button
                        type="button"
                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className="text-default-400"
                        onClick={() => setShowPassword((value) => !value)}
                      >
                        {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                      </button>
                    }
                  />
                  <Input
                    isRequired
                    type={showConfirmation ? "text" : "password"}
                    label="Confirmar nueva contraseña"
                    labelPlacement="outside"
                    placeholder="Repite la nueva contraseña"
                    value={passwordConfirmation}
                    onValueChange={setPasswordConfirmation}
                    isInvalid={passwordConfirmation.length > 0 && password !== passwordConfirmation}
                    errorMessage="Las contraseñas no coinciden."
                    endContent={
                      <button
                        type="button"
                        aria-label={showConfirmation ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className="text-default-400"
                        onClick={() => setShowConfirmation((value) => !value)}
                      >
                        {showConfirmation ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                      </button>
                    }
                  />
                </div>
              </CardBody>

              <CardFooter className="justify-end border-t border-divider bg-default-50/50 px-6 py-4">
                <Button
                  type="submit"
                  color="warning"
                  variant="flat"
                  isLoading={isChangingPassword}
                  isDisabled={!isValidPassword || isChangingPassword}
                  startContent={!isChangingPassword ? <LuShieldCheck size={18} /> : undefined}
                >
                  Actualizar contraseña
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};
