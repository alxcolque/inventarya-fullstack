import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Tooltip,
  Card,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Skeleton,
} from "@nextui-org/react";
import {
  LuUsers,
  LuUserPlus,
  LuSearch,
  LuPencil,
  LuTrash2,
  LuEye,
  LuPhone,
  LuMail,
  LuMapPin,
  LuCreditCard,
  LuCopy,
  LuCheck,
  LuAlertTriangle,
} from "react-icons/lu";
import { toast } from "sonner";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useCustomerStore } from "../../store/customer/customer.store";
import { CustomerModal } from "../../components/CustomerModal";
import { ICustomerResponse } from "@/interface";

export const IndexCustomers = () => {
  const navigate = useNavigate();
  const token = useTenantAuthStore((state) => state.token);
  const can = useTenantAuthStore((state) => state.can);

  const canCreate = can("customers:create");
  const canUpdate = can("customers:update");
  const canDelete = can("customers:delete");

  const customers = useCustomerStore((state) => state.customers);
  const getCustomers = useCustomerStore((state) => state.getCustomers);
  const createCustomer = useCustomerStore((state) => state.createCustomer);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);
  const deleteCustomer = useCustomerStore((state) => state.deleteCustomer);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Record<string, any> | null>(null);

  // Modal para confirmación de eliminación
  const [customerToDelete, setCustomerToDelete] = useState<ICustomerResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Copied state for CI/NIT
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoading(true);
      await getCustomers(token!);
      setIsLoading(false);
    };
    fetchCustomers();
  }, [getCustomers, token]);

  const getDocTypeLabel = (type?: number | null) => {
    switch (Number(type)) {
      case 1:
        return "CI";
      case 5:
        return "NIT";
      case 2:
        return "CEX";
      case 3:
        return "PAS";
      case 4:
        return "OD";
      default:
        return "DOC";
    }
  };

  const getCustomerDocument = (c: ICustomerResponse) => {
    const docNum = c.document_number || c.cinit || "";
    if (!docNum) return "";
    return c.document_complement ? `${docNum}-${c.document_complement}` : docNum;
  };

  // Filtrado reactivo en tiempo real
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((c) => {
      const name = c.name?.toLowerCase() || "";
      const docNum = (c.document_number || c.cinit || "").toLowerCase();
      const complement = c.document_complement?.toLowerCase() || "";
      const email = c.email?.toLowerCase() || "";
      const phone = c.phone?.toLowerCase() || "";
      const address = c.address?.toLowerCase() || "";

      return (
        name.includes(query) ||
        docNum.includes(query) ||
        complement.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        address.includes(query)
      );
    });
  }, [customers, searchQuery]);

  const handleOpenCreateModal = () => {
    setSelectedCustomer(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer: ICustomerResponse) => {
    setSelectedCustomer(customer);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (formData: Record<string, any>) => {
    if (isEditing && selectedCustomer?.id) {
      return await updateCustomer(Number(selectedCustomer.id), formData, token!);
    } else {
      return await createCustomer(formData, token!);
    }
  };

  const handleConfirmDelete = async () => {
    if (!customerToDelete?.id) return;
    try {
      setIsDeleting(true);
      const success = await deleteCustomer(Number(customerToDelete.id), token!);
      if (success) {
        setCustomerToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyCi = (doc: string, id: string | number) => {
    if (!doc) return;
    navigator.clipboard.writeText(doc);
    setCopiedId(String(id));
    toast.success(`Documento "${doc}" copiado`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="my-2 px-2 sm:px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-3 pb-12">
      <DynamicBreadcrumbs title="Clientes" />

      {/* Top Bar: Contador de clientes y botón Nuevo Cliente pequeño para modo celular */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Chip
            size="sm"
            color="primary"
            variant="flat"
            startContent={<LuUsers size={14} className="ml-1" />}
            className="font-semibold text-xs"
          >
            {customers.length} {customers.length === 1 ? "cliente" : "clientes"}
          </Chip>
        </div>

        {canCreate && (
          <Button
            color="primary"
            variant="solid"
            size="sm"
            radius="lg"
            startContent={<LuUserPlus size={15} />}
            onPress={handleOpenCreateModal}
            className="font-semibold text-xs px-3 shadow-sm"
          >
            Nuevo cliente
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <Input
          placeholder="Buscar por nombre, CI/NIT, teléfono o email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
          isClearable
          size="sm"
          radius="lg"
          variant="flat"
          startContent={<LuSearch size={15} className="text-default-400" />}
          className="w-full sm:max-w-xs"
        />

        {searchQuery && (
          <span className="text-xs text-default-400 px-1">
            Resultados: <strong className="text-default-700">{filteredCustomers.length}</strong> de {customers.length}
          </span>
        )}
      </div>

      {/* Customers Table: Responsive with horizontal scroll for mobile */}
      <Card className="border-none shadow-sm rounded-2xl bg-content1 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table
            aria-label="Tabla de clientes"
            removeWrapper
            className="min-w-[640px] w-full"
          >
            <TableHeader>
              <TableColumn className="uppercase text-[11px] font-bold py-3 px-3">CLIENTE</TableColumn>
              <TableColumn className="uppercase text-[11px] font-bold py-3 px-3">DOCUMENTO / CI / NIT</TableColumn>
              <TableColumn className="uppercase text-[11px] font-bold py-3 px-3">TELÉFONO</TableColumn>
              <TableColumn className="uppercase text-[11px] font-bold py-3 px-3">CORREO</TableColumn>
              <TableColumn className="uppercase text-[11px] font-bold py-3 px-3">DIRECCIÓN</TableColumn>
              <TableColumn align="end" className="uppercase text-[11px] font-bold text-right py-3 px-3">ACCIONES</TableColumn>
            </TableHeader>
            <TableBody
              isLoading={isLoading}
              loadingContent={
                <div className="p-8 flex flex-col items-center gap-3">
                  <Skeleton className="h-6 w-40 rounded-lg" />
                  <Skeleton className="h-6 w-56 rounded-lg" />
                </div>
              }
              emptyContent={
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <div className="p-3 rounded-2xl bg-default-100 text-default-400">
                    <LuUsers size={28} />
                  </div>
                  <h3 className="text-sm font-semibold text-default-700">No hay clientes para mostrar</h3>
                  <p className="text-xs text-default-400 max-w-xs">
                    {searchQuery
                      ? `Sin coincidencias para "${searchQuery}".`
                      : "No tienes clientes registrados aún."}
                  </p>
                </div>
              }
            >
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-default-50/60 transition-colors">
                  {/* Cliente */}
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center gap-2.5 py-0.5">
                      <Avatar
                        name={customer.name}
                        size="sm"
                        className="bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 font-bold text-xs"
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-default-900 text-xs sm:text-sm">
                          {customer.name}
                        </span>
                        <span className="text-[10px] text-default-400 font-mono">
                          #{customer.id}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Documento (CI / NIT / etc.) */}
                  <TableCell className="py-2.5 px-3">
                    {getCustomerDocument(customer) ? (
                      <div className="flex items-center gap-1">
                        <Chip
                          size="sm"
                          variant="flat"
                          color="primary"
                          startContent={<LuCreditCard size={12} className="ml-1" />}
                          className="font-mono text-[11px] font-semibold"
                        >
                          <span className="text-[10px] opacity-75 mr-1 font-sans font-bold">
                            {getDocTypeLabel(customer.document_type)}:
                          </span>
                          {getCustomerDocument(customer)}
                        </Chip>
                        <Tooltip content="Copiar documento">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            radius="full"
                            onPress={() => handleCopyCi(getCustomerDocument(customer), customer.id)}
                            className="text-default-400 hover:text-foreground h-6 w-6 min-w-6"
                            aria-label="Copiar documento"
                          >
                            {copiedId === String(customer.id) ? (
                              <LuCheck size={12} className="text-success" />
                            ) : (
                              <LuCopy size={12} />
                            )}
                          </Button>
                        </Tooltip>
                      </div>
                    ) : (
                      <span className="text-xs text-default-300 italic">Sin documento</span>
                    )}
                  </TableCell>

                  {/* Teléfono */}
                  <TableCell className="py-2.5 px-3">
                    {customer.phone ? (
                      <a
                        href={`tel:${customer.phone}`}
                        className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-default-700 hover:text-primary transition-colors"
                      >
                        <LuPhone size={12} className="text-emerald-600 shrink-0" />
                        <span>{customer.phone}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-default-300 italic">-</span>
                    )}
                  </TableCell>

                  {/* Email */}
                  <TableCell className="py-2.5 px-3">
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-default-700 hover:text-primary transition-colors"
                      >
                        <LuMail size={12} className="text-blue-600 shrink-0" />
                        <span className="truncate max-w-[160px]">{customer.email}</span>
                      </a>
                    ) : (
                      <span className="text-xs text-default-300 italic">-</span>
                    )}
                  </TableCell>

                  {/* Dirección */}
                  <TableCell className="py-2.5 px-3">
                    {customer.address ? (
                      <div className="flex items-center gap-1 text-[11px] sm:text-xs text-default-600 max-w-[180px]">
                        <LuMapPin size={12} className="text-default-400 shrink-0" />
                        <span className="truncate" title={customer.address}>
                          {customer.address}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-default-300 italic">-</span>
                    )}
                  </TableCell>

                  {/* Acciones */}
                  <TableCell className="py-2.5 px-3">
                    <div className="flex items-center justify-end gap-1 min-w-[105px]">
                      <Tooltip content="Ver detalles">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="h-8 w-8 min-w-8 text-default-500 hover:text-primary rounded-lg"
                          onPress={() => navigate(`/customers/${customer.id}`)}
                          aria-label="Ver cliente"
                        >
                          <LuEye size={16} />
                        </Button>
                      </Tooltip>

                      {canUpdate && (
                        <Tooltip content="Editar cliente">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="h-8 w-8 min-w-8 text-default-500 hover:text-warning rounded-lg"
                            onPress={() => handleOpenEditModal(customer)}
                            aria-label="Editar cliente"
                          >
                            <LuPencil size={16} />
                          </Button>
                        </Tooltip>
                      )}

                      {canDelete && (
                        <Tooltip content="Eliminar cliente" color="danger">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            className="h-8 w-8 min-w-8 text-default-400 hover:text-danger rounded-lg"
                            onPress={() => setCustomerToDelete(customer)}
                            aria-label="Eliminar cliente"
                          >
                            <LuTrash2 size={16} />
                          </Button>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Customer Create & Edit Modal */}
      {isModalOpen && (
        <CustomerModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={selectedCustomer}
          isEditing={isEditing}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(customerToDelete)}
        onClose={() => setCustomerToDelete(null)}
        placement="center"
        size="sm"
        classNames={{
          base: "border border-default-200 dark:border-default-100/20 rounded-2xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2.5 text-danger border-b border-default-100 py-3">
                <LuAlertTriangle size={20} />
                <h3 className="text-base font-bold text-default-900">Eliminar Cliente</h3>
              </ModalHeader>
              <ModalBody className="py-4">
                <p className="text-sm text-default-600">
                  ¿Deseas eliminar al cliente{" "}
                  <strong className="text-default-900">"{customerToDelete?.name}"</strong>
                  {customerToDelete && getCustomerDocument(customerToDelete) && (
                    <>
                      {" "}(Doc:{" "}
                      <span className="font-mono text-primary font-semibold">
                        {getCustomerDocument(customerToDelete)}
                      </span>
                      )
                    </>
                  )}
                  ?
                </p>
              </ModalBody>
              <ModalFooter className="border-t border-default-100 py-2.5">
                <Button size="sm" variant="light" onPress={onClose} isDisabled={isDeleting} radius="lg">
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  onPress={handleConfirmDelete}
                  isLoading={isDeleting}
                  radius="lg"
                  className="font-semibold shadow-sm"
                >
                  Eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
