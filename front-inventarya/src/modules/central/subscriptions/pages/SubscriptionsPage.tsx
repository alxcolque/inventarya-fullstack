import React, { useEffect, useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Card,
  CardBody,
  User,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Selection,
  Tooltip,
} from "@nextui-org/react";
import { 
  LuSearch, 
  LuChevronDown, 
  LuCalendar, 
  LuCreditCard,
  LuClock,
  LuPlus,
  LuSparkles,
  LuTrendingUp,
  LuBan,
  LuArrowRightLeft,
  LuCheckCircle,
  LuAlertTriangle
} from "react-icons/lu";
import { useSubscriptionsStore } from "../store/subscriptions.store";
import { ISubscription } from "../interfaces/subscription.interface";
import { DynamicBreadcrumbs } from "@/components";
import { AssignPlanModal } from "../components/AssignPlanModal";
import { ChangePlanModal } from "../components/ChangePlanModal";

export const SubscriptionsPage = () => {
  const { subscriptions, stats, getSubscriptions, getStats, cancelSubscription, isLoading } = useSubscriptionsStore();
  const [filterValue, setFilterValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<Selection>("all");

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSubForChange, setSelectedSubForChange] = useState<ISubscription | null>(null);

  useEffect(() => {
    getSubscriptions();
    getStats();
  }, [getSubscriptions, getStats]);

  const filteredItems = useMemo(() => {
    let filtered = [...subscriptions];
    if (filterValue) {
      const search = filterValue.toLowerCase().trim();
      filtered = filtered.filter((sub) => {
        const tenantName = (sub.tenant?.name || "").toLowerCase();
        const tenantSlug = (sub.tenant?.slug || "").toLowerCase();
        const planName = (sub.plan?.name || "").toLowerCase();
        const idStr = String(sub.id);
        return (
          tenantName.includes(search) ||
          tenantSlug.includes(search) ||
          planName.includes(search) ||
          idStr.includes(search)
        );
      });
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((sub) =>
        Array.from(statusFilter).includes(sub.status)
      );
    }
    return filtered;
  }, [subscriptions, filterValue, statusFilter]);

  // Derived KPI metrics if stats endpoint is not yet loaded
  const kpis = useMemo(() => {
    if (stats) return stats;
    const total = subscriptions.length;
    const active = subscriptions.filter((s) => s.status === "active").length;
    const trialing = subscriptions.filter((s) => s.status === "trialing").length;
    const expired = subscriptions.filter((s) => s.status === "expired").length;
    const cancelled = subscriptions.filter((s) => s.status === "cancelled" || s.status === "canceled").length;
    const monthly_revenue = subscriptions
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + (s.price || 0), 0);
    return { total, active, trialing, expired, cancelled, monthly_revenue };
  }, [stats, subscriptions]);

  const statusColorMap: Record<string, "success" | "danger" | "warning" | "primary" | "secondary" | "default"> = {
    active: "success",
    trialing: "secondary",
    inactive: "default",
    pending: "warning",
    past_due: "warning",
    suspended: "danger",
    canceled: "danger",
    cancelled: "danger",
    expired: "default",
  };

  const statusLabelMap: Record<string, string> = {
    active: "Activa",
    trialing: "En Prueba",
    inactive: "Inactiva",
    pending: "Pendiente",
    past_due: "Pago Pendiente",
    suspended: "Suspendida",
    canceled: "Cancelada",
    cancelled: "Cancelada",
    expired: "Expirada",
  };

  const columns = [
    { name: "CLIENTE", uid: "tenant" },
    { name: "DETALLES DEL PLAN", uid: "plan" },
    { name: "ESTADO", uid: "status" },
    { name: "VIGENCIA", uid: "validity" },
    { name: "FACTURACIÓN", uid: "billing" },
    { name: "ACCIONES", uid: "actions" },
  ];

  const handleCancel = async (sub: ISubscription) => {
    if (window.confirm(`¿Estás seguro de cancelar la suscripción de "${sub.tenant?.name}"?`)) {
      await cancelSubscription(sub.id);
    }
  };

  const renderCell = (subscription: ISubscription, columnKey: React.Key) => {
    switch (columnKey) {
      case "tenant":
        return (
          <User
            avatarProps={{
              radius: "lg",
              name: subscription.tenant?.name?.charAt(0) || "T",
              className: "bg-secondary-100 text-secondary font-bold",
            }}
            description={subscription.tenant?.domain || subscription.tenant?.slug}
            name={subscription.tenant?.name || "Sin nombre"}
          />
        );
      case "plan":
        return (
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-bold text-default-800">{subscription.plan?.name || "Plan"}</p>
            <p className="text-tiny text-success font-semibold flex items-center gap-1">
              <LuCreditCard size={12}/> ${subscription.price} / {subscription.billing_cycle === "monthly" ? "mes" : "año"}
            </p>
          </div>
        );
      case "status":
        return (
          <div className="flex flex-col gap-1 items-start">
            <Chip
              className="capitalize border-none font-semibold text-xs"
              color={statusColorMap[subscription.status] || "default"}
              size="sm"
              variant="flat"
            >
              {statusLabelMap[subscription.status] || subscription.status}
            </Chip>
            {subscription.status === "trialing" && subscription.trial_ends_at && (
              <span className="text-[10px] text-secondary font-medium">
                Vence: {new Date(subscription.trial_ends_at).toLocaleDateString()}
              </span>
            )}
          </div>
        );
      case "validity":
        return (
          <div className="flex flex-col gap-0.5">
            <p className="text-tiny text-default-500 flex items-center gap-1">
              <LuCalendar size={12}/> Inicio: {subscription.starts_at ? new Date(subscription.starts_at).toLocaleDateString() : "-"}
            </p>
            <p className="text-tiny text-default-700 font-semibold flex items-center gap-1">
              <LuClock size={12}/> Fin: {subscription.ends_at ? new Date(subscription.ends_at).toLocaleDateString() : "Indefinido"}
            </p>
          </div>
        );
      case "billing":
        return (
          <div className="flex flex-col">
            <Chip size="sm" variant="bordered" color="secondary" className="border-1 text-[10px] uppercase font-bold">
              {subscription.billing_cycle === "monthly" ? "Mensual" : "Anual"}
            </Chip>
          </div>
        );
      case "actions":
        return (
          <div className="flex items-center gap-1.5">
            <Tooltip content="Cambiar Plan">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="secondary"
                onPress={() => setSelectedSubForChange(subscription)}
              >
                <LuArrowRightLeft size={16} />
              </Button>
            </Tooltip>
            {subscription.status !== "cancelled" && subscription.status !== "canceled" && (
              <Tooltip content="Cancelar Suscripción" color="danger">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => handleCancel(subscription)}
                >
                  <LuBan size={16} />
                </Button>
              </Tooltip>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const topContent = useMemo(() => (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
      <Input
        isClearable
        className="w-full sm:max-w-[40%]"
        placeholder="Buscar por cliente, slug o plan..."
        startContent={<LuSearch />}
        value={filterValue}
        onValueChange={setFilterValue}
      />
      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        <Dropdown>
          <DropdownTrigger>
            <Button endContent={<LuChevronDown />} variant="flat" size="md">
              Filtrar Estado
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            key="subscription-status-filter"
            disallowEmptySelection
            aria-label="Status Filter"
            closeOnSelect={false}
            selectedKeys={statusFilter}
            selectionMode="multiple"
            onSelectionChange={setStatusFilter}
          >
            <DropdownItem key="active">Activas</DropdownItem>
            <DropdownItem key="trialing">En Prueba (Trial)</DropdownItem>
            <DropdownItem key="pending">Pendientes</DropdownItem>
            <DropdownItem key="past_due">Pago Pendiente</DropdownItem>
            <DropdownItem key="expired">Expiradas</DropdownItem>
            <DropdownItem key="cancelled">Canceladas</DropdownItem>
            <DropdownItem key="suspended">Suspendidas</DropdownItem>
          </DropdownMenu>
        </Dropdown>

        <Button
          color="secondary"
          startContent={<LuPlus size={18} />}
          onPress={() => setIsAssignModalOpen(true)}
          className="font-semibold shadow-md"
        >
          Asignar Plan
        </Button>
      </div>
    </div>
  ), [filterValue, statusFilter]);

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-bottom-2 duration-700">
      <DynamicBreadcrumbs title="Suscripciones" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-secondary">Control de Suscripciones</h1>
          <p className="text-default-500">Gestión centralizada de planes, pruebas y periodos de facturación</p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border border-default-200/50 shadow-none bg-content1/60">
          <CardBody className="p-4 flex flex-col gap-1">
            <div className="flex justify-between items-center text-default-500 text-xs font-medium">
              <span>Total Registradas</span>
              <LuCreditCard className="text-secondary" size={16} />
            </div>
            <span className="text-2xl font-bold text-default-900">{kpis.total}</span>
          </CardBody>
        </Card>

        <Card className="border border-success-200/50 shadow-none bg-success-50/20">
          <CardBody className="p-4 flex flex-col gap-1">
            <div className="flex justify-between items-center text-success-600 text-xs font-medium">
              <span>Activas</span>
              <LuCheckCircle className="text-success" size={16} />
            </div>
            <span className="text-2xl font-bold text-success-700">{kpis.active}</span>
          </CardBody>
        </Card>

        <Card className="border border-secondary-200/50 shadow-none bg-secondary-50/20">
          <CardBody className="p-4 flex flex-col gap-1">
            <div className="flex justify-between items-center text-secondary-600 text-xs font-medium">
              <span>En Prueba (Trial)</span>
              <LuSparkles className="text-secondary" size={16} />
            </div>
            <span className="text-2xl font-bold text-secondary-700">{kpis.trialing}</span>
          </CardBody>
        </Card>

        <Card className="border border-danger-200/50 shadow-none bg-danger-50/20">
          <CardBody className="p-4 flex flex-col gap-1">
            <div className="flex justify-between items-center text-danger-600 text-xs font-medium">
              <span>Expiradas / Canceladas</span>
              <LuAlertTriangle className="text-danger" size={16} />
            </div>
            <span className="text-2xl font-bold text-danger-700">{kpis.expired + kpis.cancelled}</span>
          </CardBody>
        </Card>

        <Card className="border border-default-200/50 shadow-none bg-content1/60">
          <CardBody className="p-4 flex flex-col gap-1">
            <div className="flex justify-between items-center text-default-500 text-xs font-medium">
              <span>Ingresos Activos</span>
              <LuTrendingUp className="text-success" size={16} />
            </div>
            <span className="text-2xl font-bold text-success-600">
              ${kpis.monthly_revenue.toFixed(2)}
              <span className="text-xs font-normal text-default-400">/mes</span>
            </span>
          </CardBody>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="border-none shadow-sm bg-content1/50 backdrop-blur-md">
        <CardBody className="p-6">
          <Table 
            aria-label="Tabla de suscripciones"
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
            <TableBody items={filteredItems} loadingContent={<p>Consultando suscripciones...</p>} isLoading={isLoading}>
              {(item) => (
                <TableRow key={item.id} className="hover:bg-default-50 transition-colors">
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Modals */}
      <AssignPlanModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
      />

      <ChangePlanModal
        isOpen={!!selectedSubForChange}
        onClose={() => setSelectedSubForChange(null)}
        subscription={selectedSubForChange}
      />
    </div>
  );
};
