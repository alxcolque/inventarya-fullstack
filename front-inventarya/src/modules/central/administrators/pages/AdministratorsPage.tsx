import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Chip,
  useDisclosure,
  Card,
  CardBody,
  User,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import { 
  LuPlus, 
  LuPencil, 
  LuTrash2, 
  LuSearch, 
  LuShield,
  LuMoreVertical,
  LuMail
} from "react-icons/lu";
import { useAdministratorsStore } from "../store/administrators.store";
import { ICentralUser } from "../interfaces/central-user.interface";
import { CentralUserModal } from "../components/CentralUserModal";
import { ConfirmModal, DynamicBreadcrumbs } from "@/components";

export const AdministratorsPage = () => {
  const { users, getUsers, deleteUser, isLoading } = useAdministratorsStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedUser, setSelectedUser] = useState<ICentralUser | undefined>(undefined);
  
  const [filterValue, setFilterValue] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const filteredItems = useMemo(() => {
    return users.filter((user) =>
      user.name.toLowerCase().includes(filterValue.toLowerCase()) ||
      user.email.toLowerCase().includes(filterValue.toLowerCase())
    );
  }, [users, filterValue]);

  const handleEdit = (user: ICentralUser) => {
    setSelectedUser(user);
    onOpen();
  };

  const handleCreate = () => {
    setSelectedUser(undefined);
    onOpen();
  };

  const handleDeleteClick = (id: number) => {
    setUserToDelete(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete);
      setIsDeleteOpen(false);
      setUserToDelete(null);
    }
  };

  const roleColorMap: Record<string, "secondary" | "primary"> = {
    superadmin: "secondary",
    support: "primary",
  };

  const statusColorMap: Record<string, "success" | "default" | "danger"> = {
    active: "success",
    inactive: "default",
    suspended: "danger",
  };

  const columns = [
    { name: "ADMINISTRADOR", uid: "user" },
    { name: "ROL", uid: "role" },
    { name: "ESTADO", uid: "status" },
    { name: "ÚLTIMO ACCESO", uid: "last_login" },
    { name: "ACCIONES", uid: "actions" },
  ];

  const renderCell = (user: ICentralUser, columnKey: React.Key) => {
    switch (columnKey) {
      case "user":
        return (
          <User
            avatarProps={{ radius: "lg", src: user.avatar || undefined, name: user.name.charAt(0), className: "bg-primary-100 text-primary font-bold" }}
            description={user.email}
            name={user.name}
          >
            {user.email}
          </User>
        );
      case "role":
        return (
          <Chip
            className="capitalize border-none px-3 h-6"
            color={roleColorMap[user.role]}
            size="sm"
            variant="flat"
            startContent={<LuShield size={12} className="mr-1"/>}
          >
            {user.role}
          </Chip>
        );
      case "status":
        return (
          <Chip
            className="capitalize border-none px-3 h-6"
            color={statusColorMap[user.status]}
            size="sm"
            variant="dot"
          >
            {user.status}
          </Chip>
        );
      case "last_login":
        return (
          <div className="flex flex-col">
            <p className="text-tiny text-default-400">
              {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "Nunca"}
            </p>
          </div>
        );
      case "actions":
        return (
          <div className="relative flex justify-end items-center gap-2">
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light">
                  <LuMoreVertical className="text-default-300" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Acciones de administrador">
                <DropdownItem key="edit" startContent={<LuPencil size={14}/>} onClick={() => handleEdit(user)}>Editar</DropdownItem>
                <DropdownItem key="mail" startContent={<LuMail size={14}/>}>Enviar Email</DropdownItem>
                <DropdownItem 
                  key="delete"
                  startContent={<LuTrash2 size={14}/>} 
                  className="text-danger" 
                  color="danger"
                  onClick={() => handleDeleteClick(user.id)}
                >
                  Eliminar
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700">
      <DynamicBreadcrumbs title="Administradores" />
      
      <div className="flex justify-between items-end px-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">Administradores Centrales</h1>
          <p className="text-default-500">Gestiona los accesos al panel de control de Inventarya</p>
        </div>
        <Button color="primary" variant="shadow" startContent={<LuPlus />} onPress={handleCreate}>
          Nuevo Admin
        </Button>
      </div>

      <Card className="border-none shadow-sm bg-content1/50 backdrop-blur-md">
        <CardBody className="p-6">
          <div className="mb-4">
            <Input
              isClearable
              className="w-full sm:max-w-[44%]"
              placeholder="Buscar por nombre o email..."
              startContent={<LuSearch />}
              value={filterValue}
              onValueChange={setFilterValue}
            />
          </div>

          <Table 
            aria-label="Tabla de administradores"
            classNames={{
              wrapper: "min-h-[400px] shadow-none bg-transparent p-0",
              th: "bg-default-100/50 text-default-500 font-bold",
            }}
          >
            <TableHeader columns={columns}>
              {(column) => (
                <TableColumn key={column.uid} align={column.uid === "actions" ? "end" : "start"}>
                  {column.name}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody items={filteredItems} loadingContent={<p>Cargando administradores...</p>} isLoading={isLoading}>
              {(item) => (
                <TableRow key={item.id} className="hover:bg-default-50 transition-colors">
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <CentralUserModal 
        isOpen={isOpen} 
        onClose={onClose} 
        user={selectedUser} 
      />

      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="¿Eliminar Administrador?"
        description="Esta acción revocará permanentemente el acceso de este usuario al panel central. ¿Estás seguro?"
        isLoading={isLoading}
      />
    </div>
  );
};
