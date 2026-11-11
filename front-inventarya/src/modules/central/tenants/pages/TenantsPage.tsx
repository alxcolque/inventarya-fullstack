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
  Tooltip,
  useDisclosure,
  Card,
  CardBody,
  User,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Progress,
  Selection,
} from "@nextui-org/react";
import { 
  LuPlus, 
  LuPencil, 
  LuTrash2, 
  LuExternalLink, 
  LuSearch, 
  LuFilter,
  LuChevronDown,
  LuMoreVertical,
  LuClock,
  LuDatabase
} from "react-icons/lu";
import { useTenantsStore } from "../store/tenants.store";
import { ITenant } from "@/interface";
import { TenantModal } from "../components/TenantModal";
import { TenantDatabaseModal } from "../components/TenantDatabaseModal";
import { ConfirmModal, DynamicBreadcrumbs } from "@/components";
import { getTenantAppUrl } from "@/utils/tenant";

export const TenantsPage = () => {
  const { tenants, getTenants, deleteTenant, isLoading } = useTenantsStore();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedTenant, setSelectedTenant] = useState<ITenant | undefined>(undefined);
  
  // Database manager modal state
  const [dbTenant, setDbTenant] = useState<ITenant | undefined>(undefined);
  const [isDbOpen, setIsDbOpen] = useState(false);

  const handleDatabaseClick = (tenant: ITenant) => {
    setDbTenant(tenant);
    setIsDbOpen(true);
  };
  
  // Filtering & Searching
  const [filterValue, setFilterValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<Selection>("all");
  const [planFilter, setPlanFilter] = useState<Selection>("all");

  // For Delete Alert
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);

  useEffect(() => {
    getTenants();
  }, [getTenants]);

  const hasSearchFilter = Boolean(filterValue);

  const filteredItems = useMemo(() => {
    let filteredTenants = [...tenants];

    if (hasSearchFilter) {
      filteredTenants = filteredTenants.filter((tenant) =>
        tenant.name.toLowerCase().includes(filterValue.toLowerCase()) ||
        tenant.id.toLowerCase().includes(filterValue.toLowerCase())
      );
    }
    
    if (statusFilter !== "all") {
      filteredTenants = filteredTenants.filter((tenant) =>
        Array.from(statusFilter).includes(tenant.status)
      );
    }

    return filteredTenants;
  }, [tenants, filterValue, statusFilter]);

  const handleEdit = (tenant: ITenant) => {
    setSelectedTenant(tenant);
    onOpen();
  };

  const handleCreate = () => {
    setSelectedTenant(undefined);
    onOpen();
  };

  const handleDeleteClick = (id: string) => {
    setTenantToDelete(id);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (tenantToDelete) {
      await deleteTenant(tenantToDelete);
      setIsDeleteOpen(false);
      setTenantToDelete(null);
    }
  };

  const statusColorMap: Record<string, "warning" | "success" | "danger" | "default"> = {
    trial: "warning",
    active: "success",
    suspended: "danger",
    expired: "default",
  };

  const calculateTrialProgress = (createdAt?: string, trialEndsAt?: string | null) => {
    if (!createdAt || !trialEndsAt) return 0;
    const start = new Date(createdAt).getTime();
    const end = new Date(trialEndsAt).getTime();
    const now = new Date().getTime();
    
    if (now >= end) return 100;
    
    const total = end - start;
    const elapsed = now - start;
    return Math.min(Math.round((elapsed / total) * 100), 100);
  };

  const columns = [
    { name: "NEGOCIO", uid: "name" },
    { name: "PLAN / INFRA", uid: "plan" },
    { name: "ESTADO", uid: "status" },
    { name: "TRIAL PROGRESS", uid: "trial" },
    { name: "ACCIONES", uid: "actions" },
  ];

  const renderCell = (tenant: ITenant, columnKey: React.Key) => {
    switch (columnKey) {
      case "name":
        return (
          <User
            avatarProps={{ radius: "lg", src: undefined, name: tenant.name.charAt(0), className: "bg-primary-100 text-primary font-bold" }}
            description={
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-default-600">
                  {tenant.domain || `${tenant.slug}.inventarya.com`}
                </span>
                {import.meta.env.DEV && <span className="text-[11px] text-primary">
                  Local: localhost:{tenant.data?.local_port || 5174}
                </span>}
              </div>
            }
            name={tenant.name}
          >
            {tenant.id}
          </User>
        );
      case "plan":
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Chip size="sm" variant="dot" color="primary" className="border-none p-0 h-auto font-bold">
                {tenant.plan?.name || "Sin plan"}
              </Chip>
            </div>
            <p className="text-tiny text-default-400 flex items-center gap-1 font-mono">
              DB: {tenant.database ? `tenant_${tenant.database}` : "—"}
            </p>
          </div>
        );
      case "status":
        return (
          <Chip
            className="capitalize border-none px-3 h-6"
            color={statusColorMap[tenant.status]}
            size="sm"
            variant="flat"
          >
            {tenant.status}
          </Chip>
        );
      case "trial":
        if (tenant.status === 'trial') {
          const progress = calculateTrialProgress(tenant.created_at, tenant.trial_ends_at);
          return (
            <div className="flex flex-col gap-1 w-full max-w-[120px]">
              <Progress 
                size="sm" 
                value={progress} 
                color={progress > 80 ? "danger" : "warning"}
                className="max-w-md"
              />
              <p className="text-[10px] text-default-400 flex items-center gap-1">
                <LuClock size={10} /> 
                {progress}% consumido
              </p>
            </div>
          );
        }
        return <p className="text-tiny text-default-300">N/A</p>;
      case "actions":
        return (
          <div className="relative flex justify-end items-center gap-2">
            <Tooltip content={`Abrir: ${getTenantAppUrl(tenant)}`}>
               <Button isIconOnly size="sm" variant="light" as="a" href={getTenantAppUrl(tenant)} target="_blank">
                  <LuExternalLink size={18} className="text-default-400 hover:text-primary" />
               </Button>
            </Tooltip>
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light">
                  <LuMoreVertical className="text-default-300" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu aria-label="Acciones de tenant">
                <DropdownItem key="edit" startContent={<LuPencil size={14}/>} onClick={() => handleEdit(tenant)}>Editar Detalles</DropdownItem>
                <DropdownItem key="database" startContent={<LuDatabase size={14}/>} onClick={() => handleDatabaseClick(tenant)}>Administrar DB</DropdownItem>
                <DropdownItem key="subscription" startContent={<LuFilter size={14}/>}>Gestionar Suscripción</DropdownItem>
                <DropdownItem 
                  key="delete"
                  startContent={<LuTrash2 size={14}/>} 
                  className="text-danger" 
                  color="danger"
                  onClick={() => handleDeleteClick(tenant.id)}
                >
                  Eliminar Tenant
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        );
      default:
        return null;
    }
  };

  const onSearchChange = (value?: string) => {
    if (value) {
      setFilterValue(value);
    } else {
      setFilterValue("");
    }
  };

  const topContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-end gap-3">
          <Input
            isClearable
            className="w-full sm:max-w-[44%]"
            placeholder="Buscar por nombre o ID..."
            startContent={<LuSearch />}
            value={filterValue}
            onClear={() => onSearchChange("")}
            onValueChange={onSearchChange}
          />
          <div className="flex gap-3">
            <Dropdown>
              <DropdownTrigger className="hidden sm:flex">
                <Button endContent={<LuChevronDown className="text-small" />} variant="flat">
                  Estado
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                disallowEmptySelection
                aria-label="Table Columns"
                closeOnSelect={false}
                selectedKeys={statusFilter}
                selectionMode="multiple"
                onSelectionChange={setStatusFilter}
              >
                <DropdownItem key="trial">Trial</DropdownItem>
                <DropdownItem key="active">Activo</DropdownItem>
                <DropdownItem key="suspended">Suspendido</DropdownItem>
                <DropdownItem key="expired">Expirado</DropdownItem>
              </DropdownMenu>
            </Dropdown>
            <Button color="primary" endContent={<LuPlus />} onPress={handleCreate}>
              Nuevo Tenant
            </Button>
          </div>
        </div>
      </div>
    );
  }, [filterValue, statusFilter, onSearchChange]);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700">
      <DynamicBreadcrumbs title="Tenants" />
      
      <div className="flex flex-col gap-1 px-2">
        <h1 className="text-3xl font-bold tracking-tight">Ecosistema de Tenants</h1>
        <p className="text-default-500">Control total sobre los negocios y dominios de la plataforma</p>
      </div>

      <Card className="border-none shadow-sm bg-content1/50 backdrop-blur-md">
        <CardBody className="p-6">
          <Table 
            aria-label="Tabla de tenants avanzada"
            topContent={topContent}
            topContentPlacement="outside"
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
            <TableBody items={filteredItems} loadingContent={<p>Sincronizando...</p>} isLoading={isLoading}>
              {(item) => (
                <TableRow key={item.id}>
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <TenantModal 
        isOpen={isOpen} 
        onClose={onClose} 
        tenant={selectedTenant} 
      />

      <TenantDatabaseModal 
        isOpen={isDbOpen}
        onClose={() => setIsDbOpen(false)}
        tenant={dbTenant}
      />
 
      <ConfirmModal 
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="¿Eliminar Tenant?"
        description="Esta acción eliminará permanentemente el negocio y todas sus bases de datos. Esta operación es irreversible."
        isLoading={isLoading}
      />
    </div>
  );
};
