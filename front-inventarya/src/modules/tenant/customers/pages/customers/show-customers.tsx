import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Avatar,
  Skeleton,
  Tooltip,
} from "@nextui-org/react";
import {
  LuUsers,
  LuCreditCard,
  LuPhone,
  LuMail,
  LuMapPin,
  LuArrowLeft,
  LuPencil,
  LuCopy,
  LuCheck,
  LuCalendar,
  LuShoppingBag,
} from "react-icons/lu";
import { toast } from "sonner";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useCustomerStore } from "../../store/customer/customer.store";
import { CustomerModal } from "../../components/CustomerModal";

export const ShowCustomers = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const token = useTenantAuthStore((state) => state.token);
  const can = useTenantAuthStore((state) => state.can);
  const canUpdate = can("customers:update");

  const customer = useCustomerStore((state) => state.customer);
  const getCustomer = useCustomerStore((state) => state.getCustomer);
  const updateCustomer = useCustomerStore((state) => state.updateCustomer);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const fetchCustomerData = async () => {
      if (id) {
        setIsLoading(true);
        await getCustomer(Number(id), token!);
        setIsLoading(false);
      }
    };
    fetchCustomerData();
  }, [id, getCustomer, token]);

  const getDocTypeLabel = (type?: number | null) => {
    switch (Number(type)) {
      case 1:
        return "CI - Cédula de Identidad";
      case 5:
        return "NIT - Número de Identificación Tributaria";
      case 2:
        return "CEX - Cédula de Extranjería";
      case 3:
        return "PAS - Pasaporte";
      case 4:
        return "OD - Otro Documento";
      default:
        return "Documento de Identidad";
    }
  };

  const getCustomerDocument = () => {
    const docNum = customer?.document_number || customer?.cinit || "";
    if (!docNum) return "";
    return customer?.document_complement ? `${docNum}-${customer.document_complement}` : docNum;
  };

  const handleCopyCi = () => {
    const doc = getCustomerDocument();
    if (!doc) return;
    navigator.clipboard.writeText(doc);
    setCopied(true);
    toast.success(`Documento "${doc}" copiado`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditSubmit = async (formData: Record<string, any>) => {
    if (!customer?.id) return false;
    const success = await updateCustomer(Number(customer.id), formData, token!);
    if (success) {
      await getCustomer(Number(customer.id), token!);
      setIsEditModalOpen(false);
      return true;
    }
    return false;
  };

  if (isLoading) {
    return (
      <div className="my-3 px-4 lg:px-8 max-w-[95rem] mx-auto w-full flex flex-col gap-6">
        <DynamicBreadcrumbs title="Detalle del Cliente" />
        <Skeleton className="h-16 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-48 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!customer || !customer.id) {
    return (
      <div className="my-6 px-4 lg:px-8 max-w-[95rem] mx-auto w-full flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="p-8 rounded-3xl bg-default-50 border border-default-200 text-center max-w-md flex flex-col items-center gap-3">
          <LuUsers size={48} className="text-default-400" />
          <h2 className="text-xl font-bold text-default-800">Cliente no encontrado</h2>
          <p className="text-sm text-default-500">
            El cliente solicitado no existe o fue eliminado del sistema.
          </p>
          <Button
            color="primary"
            variant="flat"
            startContent={<LuArrowLeft size={16} />}
            onPress={() => navigate("/customers")}
          >
            Volver al listado de clientes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 px-4 lg:px-8 max-w-[95rem] mx-auto w-full flex flex-col gap-6 animate-fadeIn pb-12">
      <DynamicBreadcrumbs title={customer?.name || "Detalle del Cliente"} />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-default-50 dark:bg-default-100/20 p-4 lg:p-6 rounded-3xl border border-default-200/60 dark:border-default-100/20">
        <div className="flex items-center gap-4">
          <Button
            isIconOnly
            variant="light"
            radius="full"
            onPress={() => navigate("/customers")}
            aria-label="Volver a clientes"
            className="text-default-600 hover:text-default-900"
          >
            <LuArrowLeft size={22} />
          </Button>

          <Avatar
            name={customer.name}
            size="lg"
            className="bg-primary-100 dark:bg-primary-950/70 text-primary-600 text-xl font-bold border-2 border-primary-200"
          />

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-default-900">
                {customer.name}
              </h1>
              <Chip size="sm" color="primary" variant="flat" className="font-semibold">
                Cliente #{customer.id}
              </Chip>
            </div>
            {getCustomerDocument() && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-default-500 font-medium">Documento:</span>
                <span className="font-mono text-xs bg-default-200/60 px-2 py-0.5 rounded font-bold text-default-800">
                  {getCustomerDocument()}
                </span>
                <Tooltip content="Copiar Documento">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    radius="full"
                    onPress={handleCopyCi}
                    className="text-default-400 hover:text-foreground h-6 w-6 min-w-6"
                  >
                    {copied ? <LuCheck size={13} className="text-success" /> : <LuCopy size={13} />}
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {canUpdate && (
            <Button
              color="default"
              variant="flat"
              radius="lg"
              startContent={<LuPencil size={18} />}
              onPress={() => setIsEditModalOpen(true)}
              className="font-medium hover:bg-default-200"
            >
              Editar Cliente
            </Button>
          )}
          <Button
            color="primary"
            variant="solid"
            radius="lg"
            startContent={<LuShoppingBag size={18} />}
            onPress={() => navigate("/sales")}
            className="font-semibold shadow-md shadow-primary/20"
          >
            Ver Ventas
          </Button>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card: Identificación */}
        <Card className="border border-default-200/60 dark:border-default-100/20 shadow-sm">
          <CardHeader className="px-5 py-4 border-b border-default-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary">
              <LuCreditCard size={20} />
            </div>
            <h3 className="font-bold text-default-900 text-base">Identificación Fiscal</h3>
          </CardHeader>
          <CardBody className="p-5 flex flex-col gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Tipo de Documento
              </span>
              <span className="text-default-800 font-medium text-sm">
                {getDocTypeLabel(customer.document_type)}
              </span>
            </div>

            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Número de Documento
              </span>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-default-50 border border-default-100">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-default-900">
                    {customer.document_number || customer.cinit || "Sin número registrado"}
                  </span>
                  {customer.document_complement && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary-100 text-primary-700">
                      Comp: {customer.document_complement}
                    </span>
                  )}
                </div>
                {getCustomerDocument() && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    radius="lg"
                    startContent={copied ? <LuCheck size={14} /> : <LuCopy size={14} />}
                    onPress={handleCopyCi}
                  >
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Nombre o Razón Social
              </span>
              <p className="text-default-800 font-semibold text-sm">
                {customer.name}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Card: Contacto */}
        <Card className="border border-default-200/60 dark:border-default-100/20 shadow-sm">
          <CardHeader className="px-5 py-4 border-b border-default-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <LuPhone size={20} />
            </div>
            <h3 className="font-bold text-default-900 text-base">Datos de Contacto</h3>
          </CardHeader>
          <CardBody className="p-5 flex flex-col gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Teléfono / Celular
              </span>
              {customer.phone ? (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-2 p-3 rounded-2xl bg-default-50 border border-default-100 text-emerald-700 dark:text-emerald-400 hover:border-emerald-300 transition-colors font-semibold text-sm"
                >
                  <LuPhone size={16} />
                  <span>{customer.phone}</span>
                </a>
              ) : (
                <div className="p-3 rounded-2xl bg-default-50/50 border border-dashed border-default-200 text-xs text-default-400 italic">
                  Sin número de teléfono registrado
                </div>
              )}
            </div>

            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Correo Electrónico
              </span>
              {customer.email ? (
                <a
                  href={`mailto:${customer.email}`}
                  className="flex items-center gap-2 p-3 rounded-2xl bg-default-50 border border-default-100 text-blue-700 dark:text-blue-400 hover:border-blue-300 transition-colors font-medium text-sm truncate"
                >
                  <LuMail size={16} className="shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </a>
              ) : (
                <div className="p-3 rounded-2xl bg-default-50/50 border border-dashed border-default-200 text-xs text-default-400 italic">
                  Sin correo electrónico registrado
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Card: Ubicación y Registro */}
        <Card className="border border-default-200/60 dark:border-default-100/20 shadow-sm">
          <CardHeader className="px-5 py-4 border-b border-default-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <LuMapPin size={20} />
            </div>
            <h3 className="font-bold text-default-900 text-base">Domicilio / Ubicación</h3>
          </CardHeader>
          <CardBody className="p-5 flex flex-col gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Dirección Física
              </span>
              {customer.address ? (
                <div className="p-3 rounded-2xl bg-default-50 border border-default-100 text-default-800 text-sm flex items-start gap-2">
                  <LuMapPin size={16} className="text-default-400 shrink-0 mt-0.5" />
                  <span>{customer.address}</span>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-default-50/50 border border-dashed border-default-200 text-xs text-default-400 italic">
                  Sin dirección registrada
                </div>
              )}
            </div>

            <div className="mt-auto pt-2 border-t border-default-100 flex items-center justify-between text-xs text-default-400">
              <span className="flex items-center gap-1.5">
                <LuCalendar size={14} /> Cliente registrado
              </span>
              <span className="font-medium text-default-600">
                {customer.created_at ? new Date(customer.created_at).toLocaleDateString() : "Fecha N/A"}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Customer Edit Modal */}
      {isEditModalOpen && (
        <CustomerModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleEditSubmit}
          initialData={customer}
          isEditing={true}
        />
      )}
    </div>
  );
};
