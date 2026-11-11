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
  Tooltip,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Selection,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  useDisclosure,
} from "@nextui-org/react";
import {
  LuRotateCcw,
  LuSearch,
  LuChevronDown,
  LuQrCode,
  LuCreditCard,
  LuBanknote,
  LuFileText,
  LuCalendar,
  LuCheckCircle2,
  LuAlertTriangle,
  LuDollarSign,
  LuExternalLink,
} from "react-icons/lu";
import { FaDollarSign, FaPaypal } from "react-icons/fa6";
import { usePaymentsStore } from "../store/payments.store";
import { IPayment } from "../interfaces/payment.interface";
import { DynamicBreadcrumbs } from "@/components";
import { getImageUrl } from "@/utils/image";

export const PaymentsPage = () => {
  const { payments, getPayments, refundPayment, confirmPayment, isLoading } = usePaymentsStore();
  const [filterValue, setFilterValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<Selection>("all");

  // Refund Modal State
  const { isOpen: isRefundOpen, onOpen: openRefund, onClose: closeRefund } = useDisclosure();
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<IPayment | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);

  // Receipt Modal State
  const { isOpen: isReceiptOpen, onOpen: openReceipt, onClose: closeReceipt } = useDisclosure();
  const [selectedReceipt, setSelectedReceipt] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    getPayments();
  }, [getPayments]);

  const filteredItems = useMemo(() => {
    let filtered = [...payments];
    if (filterValue) {
      const search = filterValue.toLowerCase().trim();
      filtered = filtered.filter((payment) => {
        const tenantName = (payment.tenant?.name || "").toLowerCase();
        const ref = (payment.reference || "").toLowerCase();
        const idStr = String(payment.id);
        return tenantName.includes(search) || ref.includes(search) || idStr.includes(search);
      });
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((payment) =>
        Array.from(statusFilter).includes(payment.status)
      );
    }
    return filtered;
  }, [payments, filterValue, statusFilter]);

  // Financial KPI metrics
  const kpiStats = useMemo(() => {
    const totalCollected = payments
      .filter((p) => p.status === "paid")
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const pendingCount = payments.filter((p) => p.status === "pending").length;
    const refundedCount = payments.filter((p) => p.status === "refunded").length;
    const failedCount = payments.filter((p) => p.status === "failed").length;

    return {
      totalCollected,
      pendingCount,
      refundedCount,
      failedCount,
      totalCount: payments.length,
    };
  }, [payments]);

  const statusColorMap: Record<string, "success" | "danger" | "warning" | "default"> = {
    paid: "success",
    failed: "danger",
    pending: "warning",
    refunded: "default",
    cancelled: "default",
  };

  const methodIcons: Record<string, React.ReactNode> = {
    qr: <LuQrCode size={16} className="text-primary" />,
    card: <LuCreditCard size={16} className="text-secondary" />,
    paypal: <FaPaypal size={16} className="text-blue-500" />,
    bank_transfer: <LuBanknote size={16} className="text-success" />,
    cash: <FaDollarSign size={16} className="text-emerald-500" />,
  };

  const handleOpenRefundModal = (payment: IPayment) => {
    setSelectedPaymentForRefund(payment);
    setRefundReason("");
    openRefund();
  };

  const handleConfirmRefund = async () => {
    if (!selectedPaymentForRefund) return;
    setIsRefunding(true);
    const success = await refundPayment(selectedPaymentForRefund.id, refundReason.trim() || undefined);
    setIsRefunding(false);
    if (success) {
      closeRefund();
      setSelectedPaymentForRefund(null);
    }
  };

  const handleViewReceipt = (receipt: string, tenantName?: string) => {
    const url = getImageUrl(receipt);
    setSelectedReceipt({ url, title: "Comprobante de " + (tenantName || "Pago") });
    openReceipt();
  };

  const columns = [
    { name: "CLIENTE / REF", uid: "tenant" },
    { name: "MONTO TOTAL", uid: "amount" },
    { name: "MÉTODO", uid: "method" },
    { name: "ESTADO", uid: "status" },
    { name: "FACTURACIÓN", uid: "billing" },
    { name: "ACCIONES", uid: "actions" },
  ];

  const renderCell = (payment: IPayment, columnKey: React.Key) => {
    switch (columnKey) {
      case "tenant":
        return (
          <div className="flex flex-col gap-1">
            <User
              avatarProps={{
                radius: "lg",
                name: payment.tenant?.name ? payment.tenant.name.charAt(0).toUpperCase() : "T",
                className: "bg-success-100 text-success font-bold shrink-0",
              }}
              name={payment.tenant?.name || "Sin nombre registrado"}
              description={payment.tenant?.domain || payment.tenant?.slug || `Tenant ID: ${payment.tenant_id}`}
              className="justify-start"
            />
            <p className="text-[10px] text-default-400 font-mono ml-10">REF: {payment.reference || "N/A"}</p>
          </div>
        );
      case "amount":
        return (
          <div className="flex flex-col">
            <p className="text-sm font-bold text-success-600">
              {payment.currency || "USD"} {Number(payment.amount).toFixed(2)}
            </p>
            <p className="text-[10px] text-default-400 font-mono">ID Pago: #{payment.id}</p>
          </div>
        );
      case "method":
        return (
          <div className="flex items-center gap-2">
            {methodIcons[payment.method || ""] || <LuFileText size={16} />}
            <p className="text-xs capitalize font-medium">{payment.method?.replace("_", " ") || "S/M"}</p>
          </div>
        );
      case "status":
        return (
          <Chip
            className="capitalize border-none h-6 font-semibold"
            color={statusColorMap[payment.status] || "default"}
            size="sm"
            variant="flat"
          >
            {payment.status === "paid"
              ? "Pagado"
              : payment.status === "pending"
              ? "Pendiente"
              : payment.status === "refunded"
              ? "Reembolsado"
              : payment.status === "failed"
              ? "Fallido"
              : payment.status}
          </Chip>
        );
      case "billing":
        return (
          <div className="flex flex-col gap-1">
            <p className="text-tiny font-bold flex items-center gap-1 uppercase">
              <LuCalendar size={12} /> {payment.billing_cycle || "monthly"}
            </p>
            <p className="text-[10px] text-default-400">
              Pagado: {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "Pendiente"}
            </p>
          </div>
        );
      case "actions":
        return (
          <div className="flex items-center justify-end gap-2">
            {payment.status === "pending" && (
              <Tooltip content="Aprobar Pago & Activar Tenant">
                <Button
                  size="sm"
                  color="success"
                  variant="flat"
                  className="font-bold flex items-center gap-1.5"
                  onClick={() => confirmPayment(payment.id)}
                >
                  <LuCheckCircle2 size={16} /> Confirmar
                </Button>
              </Tooltip>
            )}
            {payment.receipt && (
              <Tooltip content="Ver Comprobante">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onClick={() => handleViewReceipt(payment.receipt!, payment.tenant?.name)}
                >
                  <LuFileText size={18} className="text-primary-500" />
                </Button>
              </Tooltip>
            )}
            {payment.status === "paid" && (
              <Tooltip content="Gestionar Reembolso" color="danger">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="danger"
                  onClick={() => handleOpenRefundModal(payment)}
                >
                  <LuRotateCcw size={18} className="text-default-400 hover:text-danger" />
                </Button>
              </Tooltip>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const topContent = useMemo(
    () => (
      <div className="flex flex-col gap-4">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-content1 rounded-xl border border-divider flex flex-col">
            <span className="text-xs text-default-400 font-medium">Recaudación Confirmada</span>
            <span className="text-xl font-black text-success mt-0.5">
              ${kpiStats.totalCollected.toFixed(2)}
            </span>
          </div>
          <div className="p-3.5 bg-content1 rounded-xl border border-divider flex flex-col">
            <span className="text-xs text-default-400 font-medium">Pagos Pendientes</span>
            <span className="text-xl font-black text-warning mt-0.5">
              {kpiStats.pendingCount}
            </span>
          </div>
          <div className="p-3.5 bg-content1 rounded-xl border border-divider flex flex-col">
            <span className="text-xs text-default-400 font-medium">Reembolsados</span>
            <span className="text-xl font-black text-default-600 mt-0.5">
              {kpiStats.refundedCount}
            </span>
          </div>
          <div className="p-3.5 bg-content1 rounded-xl border border-divider flex flex-col">
            <span className="text-xs text-default-400 font-medium">Total Registros</span>
            <span className="text-xl font-black text-default-800 mt-0.5">
              {kpiStats.totalCount}
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex justify-between items-center gap-3">
          <Input
            isClearable
            className="w-full sm:max-w-[44%]"
            placeholder="Buscar por cliente, referencia o #ID..."
            startContent={<LuSearch />}
            value={filterValue}
            onValueChange={setFilterValue}
          />
          <Dropdown>
            <DropdownTrigger>
              <Button endContent={<LuChevronDown />} variant="flat">
                Filtrar Estado
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              key="payment-status-filter"
              disallowEmptySelection
              aria-label="Payment Status Filter"
              closeOnSelect={false}
              selectedKeys={statusFilter}
              selectionMode="multiple"
              onSelectionChange={setStatusFilter}
            >
              <DropdownItem key="paid">Pagado</DropdownItem>
              <DropdownItem key="pending">Pendiente</DropdownItem>
              <DropdownItem key="failed">Fallido</DropdownItem>
              <DropdownItem key="refunded">Reembolsado</DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    ),
    [filterValue, statusFilter, kpiStats]
  );

  return (
    <div className="flex flex-col gap-6 animate-in zoom-in-95 duration-700">
      <DynamicBreadcrumbs title="Pagos" />

      <div className="flex flex-col gap-1 px-2">
        <h1 className="text-3xl font-bold tracking-tight text-success flex items-center gap-2">
          <LuDollarSign className="text-success" /> Gestión de Cobranzas y Pagos
        </h1>
        <p className="text-default-500">
          Historial financiero, conciliación de pagos y auditoría de la red SaaS
        </p>
      </div>

      <Card className="border border-divider shadow-sm bg-content1/50 backdrop-blur-md">
        <CardBody className="p-6">
          <Table
            aria-label="Tabla de pagos profesional"
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
            <TableBody items={filteredItems} loadingContent={<p>Sincronizando transacciones...</p>} isLoading={isLoading}>
              {(item) => (
                <TableRow key={item.id} className="hover:bg-default-50 transition-colors">
                  {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Refund Confirmation Modal */}
      <Modal isOpen={isRefundOpen} onClose={closeRefund} size="md" placement="center">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-danger font-bold text-lg">
                  <LuAlertTriangle className="text-danger" />
                  <span>Confirmar Reembolso</span>
                </div>
                <p className="text-xs text-default-400 font-normal">
                  Esta acción revertirá el cobro del cliente y registrará el estado como reembolsado.
                </p>
              </ModalHeader>
              <ModalBody className="gap-3">
                {selectedPaymentForRefund && (
                  <div className="bg-default-50 p-3.5 rounded-xl border border-default-200 text-xs flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-default-500">Cliente:</span>
                      <span className="font-bold text-default-800">{selectedPaymentForRefund.tenant?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">Monto:</span>
                      <span className="font-bold text-success">
                        {selectedPaymentForRefund.currency} {Number(selectedPaymentForRefund.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-default-500">ID / Referencia:</span>
                      <span className="font-mono text-default-700">
                        #{selectedPaymentForRefund.id} ({selectedPaymentForRefund.reference || "S/R"})
                      </span>
                    </div>
                  </div>
                )}
                <Textarea
                  label="Motivo del Reembolso"
                  placeholder="Explica el motivo (ej. Duplicación de cobro, cancelación a solicitud del cliente)..."
                  value={refundReason}
                  onValueChange={setRefundReason}
                  variant="bordered"
                  minRows={2}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={closeRefund} isDisabled={isRefunding}>
                  Cancelar
                </Button>
                <Button color="danger" onPress={handleConfirmRefund} isLoading={isRefunding}>
                  Confirmar Reembolso
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Receipt Viewer Modal */}
      <Modal isOpen={isReceiptOpen} onClose={closeReceipt} size="2xl" placement="center">
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex justify-between items-center">
                <span>{selectedReceipt?.title || "Comprobante"}</span>
                {selectedReceipt?.url && (
                  <Button
                    size="sm"
                    variant="light"
                    color="primary"
                    startContent={<LuExternalLink />}
                    onPress={() => window.open(selectedReceipt.url, "_blank")}
                  >
                    Abrir en pestaña
                  </Button>
                )}
              </ModalHeader>
              <ModalBody className="p-4 flex items-center justify-center min-h-[300px]">
                {selectedReceipt?.url ? (
                  selectedReceipt.url.endsWith(".pdf") ? (
                    <iframe
                      src={selectedReceipt.url}
                      className="w-full h-[450px] rounded-lg border border-divider"
                      title="Comprobante PDF"
                    />
                  ) : (
                    <img
                      src={selectedReceipt.url}
                      alt="Comprobante"
                      className="max-h-[450px] max-w-full object-contain rounded-lg border border-divider shadow-sm"
                    />
                  )
                ) : (
                  <p className="text-default-400 text-sm">No se pudo cargar el archivo.</p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={closeReceipt}>
                  Cerrar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
