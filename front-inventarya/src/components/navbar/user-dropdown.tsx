import {
  Avatar,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  NavbarItem,
} from "@nextui-org/react";
import { useState } from "react";
import { DarkModeSwitch } from "./darkmodeswitch";
import { useNavigate } from "react-router-dom";
import { isCentral } from "@/utils/tenant";
import { useCentralAuthStore } from "@/modules/auth/store/centralAuth.store";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { LuLayoutDashboard, LuStore, LuLogOut, LuUserX } from "react-icons/lu";
import { AccountDeletionModal } from "@/modules/tenant/settings/components/AccountDeletionModal";

const roleColor: Record<string, "success" | "warning" | "primary" | "danger" | "default" | "secondary"> = {
  superadmin: "danger",
  support: "warning",
  owner: "secondary",
  admin: "success",
  staff: "primary",
  worker: "primary",
};

export const UserDropdown = () => {
  const navigate = useNavigate();
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false);

  const centralUser = useCentralAuthStore((state) => state.user);
  const centralLogout = useCentralAuthStore((state) => state.logout);
  const tenantUser = useTenantAuthStore((state) => state.user);
  const tenantLogout = useTenantAuthStore((state) => state.logout);

  const user = isCentral() ? centralUser : tenantUser;
  const logout = isCentral() ? centralLogout : tenantLogout;
  const isAdminOrOwner = user?.role === "owner" || user?.role === "admin";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Dropdown placement="bottom-end">
      <NavbarItem>
        <DropdownTrigger>
          <Avatar
            as="button"
            color={isAdminOrOwner ? "primary" : "secondary"}
            size="md"
            src={user?.avatar ?? undefined}
            name={user?.name?.charAt(0).toUpperCase()}
            className="cursor-pointer transition-transform hover:scale-105"
          />
        </DropdownTrigger>
      </NavbarItem>
      <DropdownMenu aria-label="Acciones de usuario">
        <DropdownItem
          key="profile"
          className="flex flex-col justify-start w-full items-start cursor-default"
          textValue={user?.name ?? "Perfil"}
        >
          <p className="font-bold text-sm text-foreground">{user?.name}</p>
          <p className="text-xs text-default-500">{user?.email}</p>
          <div className="mt-1">
            <Chip size="sm" variant="flat" color={roleColor[user?.role ?? ""] ?? "default"}>
              <span className="capitalize text-[11px] font-semibold">{user?.role}</span>
            </Chip>
          </div>
        </DropdownItem>

        <DropdownItem
          key="shops"
          startContent={<LuStore className="text-base text-primary" />}
          onPress={() => navigate("/tienda")}
          className="font-medium"
        >
          Cambiar de Sucursal
        </DropdownItem>

        {isAdminOrOwner ? (
          <DropdownItem
            key="admin"
            startContent={<LuLayoutDashboard className="text-base text-primary" />}
            onPress={() => navigate("/dashboard")}
            className="font-semibold text-primary"
          >
            Administrar
          </DropdownItem>
        ) : (
          <DropdownItem
            key="admin-disabled"
            isDisabled
            startContent={<LuLayoutDashboard className="text-base text-default-300" />}
            className="opacity-40 cursor-not-allowed"
            description="Solo disponible para administradores"
          >
            Administrar
          </DropdownItem>
        )}

        <DropdownItem key="theme" textValue="Tema" isReadOnly>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-default-600 font-medium">Modo oscuro</span>
            <DarkModeSwitch />
          </div>
        </DropdownItem>

        <DropdownItem
          key="delete-account"
          className="text-danger-500 font-medium text-xs"
          startContent={<LuUserX className="text-base text-danger-500" />}
          onPress={() => {
            if (isCentral()) {
              navigate("/delete-account");
            } else {
              setIsDeletionModalOpen(true);
            }
          }}
        >
          Solicitar eliminación de cuenta
        </DropdownItem>

        <DropdownItem
          key="logout"
          color="danger"
          className="text-danger font-medium"
          startContent={<LuLogOut className="text-base text-danger" />}
          onPress={handleLogout}
        >
          Cerrar sesión
        </DropdownItem>
      </DropdownMenu>

      <AccountDeletionModal
        isOpen={isDeletionModalOpen}
        onClose={() => setIsDeletionModalOpen(false)}
      />
    </Dropdown>
  );
};
