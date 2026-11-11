import React, { useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
} from "@nextui-org/react";
import { useForm } from "react-hook-form";
import { ICentralUser } from "../interfaces/central-user.interface";
import { useAdministratorsStore } from "../store/administrators.store";
import { LuUser, LuMail, LuLock, LuShield, LuActivity } from "react-icons/lu";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user?: ICentralUser;
}

export const CentralUserModal = ({ isOpen, onClose, user }: Props) => {
  const { createUser, updateUser, isLoading } = useAdministratorsStore();
  
  const { 
    register, 
    handleSubmit, 
    reset, 
    formState: { errors, isValid } 
  } = useForm<Partial<ICentralUser>>({
    mode: "onChange",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "superadmin",
      status: "active",
    },
  });

  useEffect(() => {
    if (user && isOpen) {
      reset({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        password: "", // Contraseña vacía por defecto en edición
      });
    } else if (isOpen) {
      reset({
        name: "",
        email: "",
        password: "",
        role: "superadmin",
        status: "active",
      });
    }
  }, [user, reset, isOpen]);

  const onSubmit = async (data: Partial<ICentralUser>) => {
    let success = false;
    if (user) {
      success = await updateUser(user.id, data);
    } else {
      success = await createUser(data);
    }
    if (success) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" backdrop="blur">
      <ModalContent>
        {(onClose) => (
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <LuUser className="text-primary" />
                <span className="text-xl font-bold">
                  {user ? "Editar Administrador" : "Nuevo Administrador Central"}
                </span>
              </div>
            </ModalHeader>
            <ModalBody className="py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  isRequired
                  label="Nombre Completo"
                  placeholder="Juan Perez"
                  labelPlacement="outside"
                  startContent={<LuUser size={18} className="text-default-400" />}
                  {...register("name", { required: "El nombre es obligatorio" })}
                  isInvalid={!!errors.name}
                  errorMessage={errors.name?.message}
                />
                <Input
                  isRequired
                  label="Correo Electrónico"
                  placeholder="user@mail.com"
                  type="email"
                  labelPlacement="outside"
                  startContent={<LuMail size={18} className="text-default-400" />}
                  {...register("email", { 
                    required: "El email es obligatorio",
                    pattern: { value: /^\S+@\S+$/i, message: "Email inválido" }
                  })}
                  isInvalid={!!errors.email}
                  errorMessage={errors.email?.message}
                />
                <Input
                  isRequired={!user}
                  label={user ? "Nueva Contraseña (opcional)" : "Contraseña"}
                  placeholder="******"
                  type="password"
                  labelPlacement="outside"
                  startContent={<LuLock size={18} className="text-default-400" />}
                  {...register("password", { 
                    required: user ? false : "La contraseña es obligatoria",
                    minLength: { value: 6, message: "Mínimo 6 caracteres" }
                  })}
                  isInvalid={!!errors.password}
                  errorMessage={errors.password?.message}
                />
                <Select
                  isRequired
                  label="Rol en el Sistema"
                  labelPlacement="outside"
                  startContent={<LuShield size={18} className="text-default-400" />}
                  defaultSelectedKeys={[user?.role || "superadmin"]}
                  {...register("role", { required: true })}
                >
                  <SelectItem key="superadmin" value="superadmin">Super Administrador</SelectItem>
                  <SelectItem key="support" value="support">Soporte Técnico</SelectItem>
                </Select>
                <Select
                  isRequired
                  label="Estado de la Cuenta"
                  labelPlacement="outside"
                  startContent={<LuActivity size={18} className="text-default-400" />}
                  defaultSelectedKeys={[user?.status || "active"]}
                  {...register("status", { required: true })}
                >
                  <SelectItem key="active" value="active">Activo</SelectItem>
                  <SelectItem key="inactive" value="inactive">Inactivo</SelectItem>
                  <SelectItem key="suspended" value="suspended">Suspendido</SelectItem>
                </Select>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Cancelar
              </Button>
              <Button 
                color="primary" 
                type="submit" 
                isLoading={isLoading}
                isDisabled={!isValid}
              >
                {user ? "Actualizar" : "Crear Usuario"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
