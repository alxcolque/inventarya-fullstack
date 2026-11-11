import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  Tabs,
  Tab,
  Chip,
  Divider,
  Checkbox,
  Accordion,
  AccordionItem,
} from '@nextui-org/react';
import {
  LuUserX,
  LuShieldAlert,
  LuMail,
  LuBuilding,
  LuSearch,
  LuCheckCircle2,
  LuClock,
  LuAlertTriangle,
  LuFileText,
  LuArrowLeft,
  LuCopy,
  LuCheck,
  LuSmartphone,
  LuDatabase,
  LuHelpCircle,
} from 'react-icons/lu';
import { useSeo } from '@/hooks/useSeo';
import {
  accountDeletionApi,
  DeletionStatusResponse,
} from '@/api/accountDeletionApi';
import { toast } from 'sonner';

export const DeleteAccountPage: React.FC = () => {
  useSeo({
    title: 'Solicitud de Eliminación de Cuenta',
    description:
      'Mecanismo oficial de eliminación de cuentas y privacidad de datos de INVENTARYA para usuarios y dispositivos Android de Google Play.',
    path: '/delete-account',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Active tab: 'request' | 'status' | 'confirm'
  const [activeTab, setActiveTab] = useState<string>('request');

  // Request form state
  const [email, setEmail] = useState('');
  const [tenant, setTenant] = useState('');
  const [reason, setReason] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Status check state
  const [searchTicket, setSearchTicket] = useState('');
  const [isSearchingStatus, setIsSearchingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<DeletionStatusResponse | null>(null);

  // Direct Token Confirmation state
  const [confirmToken, setConfirmToken] = useState<string>('');
  const [confirmTicketParam, setConfirmTicketParam] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
    userType?: 'employee' | 'owner';
  } | null>(null);

  // Detect token and ticket from query params or URL hash (#token=...&ticket=...)
  useEffect(() => {
    let tokenFromUrl = searchParams.get('token');
    let ticketFromUrl = searchParams.get('ticket');

    if (!tokenFromUrl && window.location.hash) {
      const hashStr = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashStr);
      tokenFromUrl = hashParams.get('token');
      if (!ticketFromUrl) {
        ticketFromUrl = hashParams.get('ticket');
      }
    }

    if (tokenFromUrl) {
      setConfirmToken(tokenFromUrl);
      if (ticketFromUrl) setConfirmTicketParam(ticketFromUrl);
      setActiveTab('confirm');
    } else if (ticketFromUrl) {
      setSearchTicket(ticketFromUrl);
      setActiveTab('status');
      void handleCheckStatus(ticketFromUrl);
    }
  }, [searchParams]);

  // Submit deletion request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !tenant) {
      toast.error('Por favor complete su correo electrónico y el nombre o identificador de su empresa.');
      return;
    }
    if (!termsAccepted) {
      toast.error('Debe confirmar que comprende el alcance de la solicitud.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await accountDeletionApi.requestPublicDeletion({
        email: email.trim().toLowerCase(),
        tenant: tenant.trim(),
        reason: reason.trim() || undefined,
      });

      setSubmittedTicket(res.ticket ?? null);
      setSubmittedMessage(res.message);
      toast.success('Solicitud procesada correctamente.');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error al procesar la solicitud. Intente nuevamente más tarde.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check ticket status
  const handleCheckStatus = async (ticketToSearch?: string) => {
    const t = ticketToSearch || searchTicket;
    if (!t.trim()) {
      toast.error('Ingrese el código de ticket recibido (ej. DEL-XXXXXXXX).');
      return;
    }

    try {
      setIsSearchingStatus(true);
      const res = await accountDeletionApi.checkStatus(t);
      setStatusResult(res);
    } catch (err: any) {
      setStatusResult(null);
      const msg = err.response?.data?.message || 'No se encontró ninguna solicitud con el ticket proporcionado.';
      toast.error(msg);
    } finally {
      setIsSearchingStatus(false);
    }
  };

  // Confirm token
  const handleConfirmToken = async () => {
    if (!confirmToken.trim()) {
      toast.error('El token de confirmación no es válido o está ausente.');
      return;
    }

    try {
      setIsConfirming(true);
      const res = await accountDeletionApi.confirmDeletion(confirmToken.trim());
      setConfirmResult({
        success: res.success,
        message: res.message,
        details: res.details,
        userType: res.user_type,
      });
      toast.success(res.message);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'El token de verificación es inválido o ha expirado (48h).';
      setConfirmResult({
        success: false,
        message: msg,
      });
      toast.error(msg);
    } finally {
      setIsConfirming(false);
    }
  };

  const copyTicketToClipboard = (ticket: string) => {
    navigator.clipboard.writeText(ticket);
    setCopiedTicket(true);
    toast.success('Ticket copiado al portapapeles');
    setTimeout(() => setCopiedTicket(false), 2500);
  };

  const statusBadge = useMemo(() => {
    if (!statusResult) return null;
    switch (statusResult.status) {
      case 'pending_verification':
        return (
          <Chip color="warning" variant="flat" startContent={<LuClock size={14} className="ml-1" />}>
            Pendiente de verificación (Correo enviado)
          </Chip>
        );
      case 'verified_employee_deleted':
        return (
          <Chip color="success" variant="flat" startContent={<LuCheckCircle2 size={14} className="ml-1" />}>
            Completada — Cuenta y datos personales eliminados
          </Chip>
        );
      case 'verified_owner_review':
        return (
          <Chip color="primary" variant="flat" startContent={<LuShieldAlert size={14} className="ml-1" />}>
            Verificada — En revisión para cierre o transferencia de empresa
          </Chip>
        );
      case 'expired':
        return (
          <Chip color="danger" variant="flat" startContent={<LuAlertTriangle size={14} className="ml-1" />}>
            Expirada (Superó el plazo de 48 horas)
          </Chip>
        );
      default:
        return <Chip color="default" variant="flat">{statusResult.status_label || statusResult.status}</Chip>;
    }
  }, [statusResult]);

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation & Back link */}
        <div className="flex items-center justify-between">
          <Button
            variant="light"
            size="sm"
            startContent={<LuArrowLeft size={16} />}
            onPress={() => navigate('/')}
            className="text-default-600 hover:text-foreground font-medium"
          >
            Volver a INVENTARYA
          </Button>

          <div className="flex items-center gap-2">
            <Chip size="sm" variant="bordered" color="default" startContent={<LuSmartphone size={12} className="ml-1" />}>
              Google Play Compliance
            </Chip>
          </div>
        </div>

        {/* Page Hero Header */}
        <div className="bg-gradient-to-br from-content1 to-content2 border border-divider rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-danger-500/10 text-danger border border-danger-500/20 shrink-0">
              <LuUserX size={32} />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                Eliminación de Cuenta y Privacidad de Datos
              </h1>
              <p className="text-xs sm:text-sm text-default-500 leading-relaxed">
                En cumplimiento con las políticas para desarrolladores de Google Play y las normativas de protección de datos,
                INVENTARYA proporciona a sus usuarios un mecanismo transparente y seguro para solicitar la eliminación de su cuenta y datos personales.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Tabs */}
        <Card className="shadow-sm border border-divider rounded-2xl">
          <CardBody className="p-6">
            <Tabs
              aria-label="Opciones de eliminación de cuenta"
              selectedKey={activeTab}
              onSelectionChange={(k) => setActiveTab(k as string)}
              color="danger"
              variant="underlined"
              classNames={{
                tabList: 'gap-4 border-b border-divider pb-2',
                cursor: 'w-full bg-danger',
                tab: 'max-w-fit px-2 h-9 text-xs sm:text-sm font-semibold',
              }}
            >
              {/* TAB 1: FORMULARIO DE SOLICITUD */}
              <Tab
                key="request"
                title={
                  <div className="flex items-center gap-2">
                    <LuFileText size={16} />
                    <span>Solicitar Eliminación</span>
                  </div>
                }
              >
                <div className="pt-4 space-y-6">
                  {submittedTicket ? (
                    <div className="p-5 rounded-2xl bg-success-500/10 border border-success-500/20 space-y-4 animate-in fade-in">
                      <div className="flex items-start gap-3">
                        <LuCheckCircle2 size={24} className="text-success shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-foreground">Solicitud Registrada</h3>
                          <p className="text-xs text-default-600 leading-relaxed">
                            {submittedMessage}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-background/80 rounded-xl border border-divider flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-default-400 font-semibold block">
                            Código de Seguimiento (Ticket):
                          </span>
                          <span className="font-mono text-sm font-bold text-foreground">
                            {submittedTicket}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => copyTicketToClipboard(submittedTicket)}
                          startContent={copiedTicket ? <LuCheck size={14} /> : <LuCopy size={14} />}
                        >
                          {copiedTicket ? 'Copiado' : 'Copiar Ticket'}
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="bordered"
                          onPress={() => {
                            setSearchTicket(submittedTicket);
                            setActiveTab('status');
                            void handleCheckStatus(submittedTicket);
                          }}
                        >
                          Consultar Estado de este Ticket
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          onPress={() => {
                            setSubmittedTicket(null);
                            setEmail('');
                            setTenant('');
                            setReason('');
                            setTermsAccepted(false);
                          }}
                        >
                          Crear otra solicitud
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitRequest} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          isRequired
                          type="email"
                          label="Correo Electrónico de la Cuenta"
                          placeholder="usuario@empresa.com"
                          labelPlacement="outside"
                          value={email}
                          onValueChange={setEmail}
                          startContent={<LuMail size={16} className="text-default-400" />}
                          description="Debe coincidir con la cuenta registrada en INVENTARYA."
                        />

                        <Input
                          isRequired
                          type="text"
                          label="Empresa o Negocio (Organización)"
                          placeholder="ej. mitienda o nombre del comercio"
                          labelPlacement="outside"
                          value={tenant}
                          onValueChange={setTenant}
                          startContent={<LuBuilding size={16} className="text-default-400" />}
                          description="Slug, subdominio o nombre comercial de su empresa."
                        />
                      </div>

                      <Textarea
                        label="Motivo de la solicitud (Opcional)"
                        placeholder="Indique brevemente el motivo para ayudarnos a mejorar el servicio..."
                        labelPlacement="outside"
                        minRows={2}
                        value={reason}
                        onValueChange={setReason}
                      />

                      <div className="p-3.5 rounded-xl bg-default-100/70 border border-divider text-xs text-default-600 space-y-2">
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <LuShieldAlert size={15} className="text-warning" />
                          <span>Verificación obligatoria de identidad</span>
                        </div>
                        <p className="leading-relaxed">
                          Por seguridad, no se procesará ninguna eliminación de forma inmediata sin comprobar la posesión del correo.
                          Le enviaremos un correo con un enlace criptográfico seguro con validez de <strong>48 horas</strong>.
                        </p>
                      </div>

                      <Checkbox
                        isSelected={termsAccepted}
                        onValueChange={setTermsAccepted}
                        size="sm"
                        color="danger"
                        classNames={{
                          label: 'text-xs text-default-600',
                        }}
                      >
                        Comprendo que la confirmación de esta solicitud anonimizará mis datos de acceso y revocará todas mis sesiones de INVENTARYA y dispositivos Android.
                      </Checkbox>

                      <div className="pt-2 flex justify-end">
                        <Button
                          type="submit"
                          color="danger"
                          isLoading={isSubmitting}
                          isDisabled={!email || !tenant || !termsAccepted || isSubmitting}
                          className="font-bold text-xs sm:text-sm px-6"
                          startContent={!isSubmitting && <LuUserX size={16} />}
                        >
                          Solicitar Eliminación de Cuenta
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </Tab>

              {/* TAB 2: CONSULTAR ESTADO */}
              <Tab
                key="status"
                title={
                  <div className="flex items-center gap-2">
                    <LuSearch size={16} />
                    <span>Consultar Estado</span>
                  </div>
                }
              >
                <div className="pt-4 space-y-6">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      placeholder="Ingrese código de ticket (ej. DEL-A1B2C3D4)"
                      value={searchTicket}
                      onValueChange={setSearchTicket}
                      size="sm"
                      className="flex-1"
                      startContent={<LuSearch size={16} className="text-default-400" />}
                    />
                    <Button
                      color="primary"
                      size="sm"
                      isLoading={isSearchingStatus}
                      onPress={() => handleCheckStatus()}
                      className="font-semibold"
                    >
                      Buscar Ticket
                    </Button>
                  </div>

                  {statusResult && (
                    <div className="p-5 rounded-2xl bg-default-50 border border-divider space-y-4 animate-in fade-in">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-divider pb-3">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-default-400 font-semibold block">
                            Ticket de Seguimiento
                          </span>
                          <span className="font-mono text-base font-bold text-foreground">
                            {statusResult.ticket}
                          </span>
                        </div>
                        <div>
                          {statusBadge}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-default-400 block font-medium">Cuenta Solicitada:</span>
                          <span className="text-foreground font-mono font-semibold">{statusResult.email}</span>
                        </div>
                        <div>
                          <span className="text-default-400 block font-medium">Empresa Asociada:</span>
                          <span className="text-foreground font-semibold">{statusResult.tenant_name}</span>
                        </div>
                        <div>
                          <span className="text-default-400 block font-medium">Fecha de Solicitud:</span>
                          <span className="text-foreground">
                            {new Date(statusResult.requested_at).toLocaleString('es-ES')}
                          </span>
                        </div>
                        <div>
                          <span className="text-default-400 block font-medium">Expiración del Enlace:</span>
                          <span className="text-foreground">
                            {new Date(statusResult.expires_at).toLocaleString('es-ES')}
                          </span>
                        </div>
                      </div>

                      {statusResult.completed_at && (
                        <div className="p-3 bg-success-500/10 rounded-xl border border-success-500/20 text-xs text-success-800 dark:text-success-300">
                          <strong>Procesada el:</strong> {new Date(statusResult.completed_at).toLocaleString('es-ES')}
                        </div>
                      )}

                      {statusResult.notes && (
                        <div className="p-3 bg-default-100 rounded-xl text-xs text-default-600">
                          <span className="font-semibold block text-foreground mb-0.5">Información adicional:</span>
                          {statusResult.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Tab>

              {/* TAB 3: VERIFICACIÓN CON TOKEN */}
              <Tab
                key="confirm"
                title={
                  <div className="flex items-center gap-2">
                    <LuCheckCircle2 size={16} />
                    <span>Confirmar con Token</span>
                  </div>
                }
              >
                <div className="pt-4 space-y-6">
                  {confirmResult ? (
                    <div
                      className={`p-5 rounded-2xl border space-y-3 ${
                        confirmResult.success
                          ? 'bg-success-500/10 border-success-500/20 text-foreground'
                          : 'bg-danger-500/10 border-danger-500/20 text-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {confirmResult.success ? (
                          <LuCheckCircle2 size={24} className="text-success shrink-0 mt-0.5" />
                        ) : (
                          <LuAlertTriangle size={24} className="text-danger shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold">
                            {confirmResult.success ? 'Confirmación Exitosa' : 'No se pudo confirmar la solicitud'}
                          </h3>
                          <p className="text-xs text-default-600 leading-relaxed">
                            {confirmResult.message}
                          </p>
                          {confirmResult.details && (
                            <p className="text-xs text-default-500 mt-2 bg-background/60 p-2.5 rounded-lg border border-divider">
                              {confirmResult.details}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => navigate('/')}
                        >
                          Ir al Inicio
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-danger-500/5 border border-danger-500/20 space-y-2">
                        <div className="flex items-center gap-2 text-danger font-bold text-xs sm:text-sm">
                          <LuAlertTriangle size={18} />
                          <span>Paso Final: Confirmar Eliminación</span>
                        </div>
                        <p className="text-xs text-default-600 leading-relaxed">
                          Al presionar el botón de confirmación, se verificará su identidad y se procederá con la eliminación
                          y revocación de credenciales.
                        </p>
                        {confirmTicketParam && (
                          <div className="text-xs text-default-500">
                            <strong>Ticket asociado:</strong> {confirmTicketParam}
                          </div>
                        )}
                      </div>

                      <Input
                        label="Token de Verificación"
                        placeholder="Pegue aquí el token recibido por correo si no se cargó automáticamente"
                        value={confirmToken}
                        onValueChange={setConfirmToken}
                        size="sm"
                        labelPlacement="outside"
                      />

                      <div className="pt-2 flex justify-end">
                        <Button
                          color="danger"
                          isLoading={isConfirming}
                          isDisabled={!confirmToken.trim() || isConfirming}
                          onPress={handleConfirmToken}
                          className="font-bold text-xs sm:text-sm px-6"
                          startContent={!isConfirming && <LuCheckCircle2 size={16} />}
                        >
                          Confirmar y Procesar Eliminación
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Tab>
            </Tabs>
          </CardBody>
        </Card>

        {/* Informative Accordions - Compliance with Google Play Policies */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <LuHelpCircle size={18} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Transparencia y Políticas de Conservación de Datos
            </h2>
          </div>

          <Accordion variant="splitted" className="px-0">
            <AccordionItem
              key="what-is-deleted"
              aria-label="Datos personales que se eliminan"
              title={<span className="text-xs sm:text-sm font-bold">¿Qué datos personales se eliminan?</span>}
              startContent={<LuUserX size={18} className="text-danger" />}
            >
              <div className="text-xs text-default-600 space-y-2 pb-2 leading-relaxed">
                <p>Al confirmar la eliminación de la cuenta:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Se eliminan todas las credenciales de autenticación (contraseñas y llaves de acceso).</li>
                  <li>Se revocan de manera inmediata todos los tokens de sesión activos (Bearer / Sanctum).</li>
                  <li>Se borran los tokens de dispositivos móviles (FCM tokens de Android) para impedir el envío de notificaciones.</li>
                  <li>Su nombre, correo electrónico y teléfono personal son anonimizados irreversibly en el sistema.</li>
                </ul>
              </div>
            </AccordionItem>

            <AccordionItem
              key="what-is-retained"
              aria-label="Datos comerciales que se conservan y plazos"
              title={<span className="text-xs sm:text-sm font-bold">¿Qué datos se conservan y durante cuánto tiempo?</span>}
              startContent={<LuDatabase size={18} className="text-primary" />}
            >
              <div className="text-xs text-default-600 space-y-2 pb-2 leading-relaxed">
                <p>
                  En cumplimiento con las normativas fiscales, tributarias y comerciales vigentes en los países donde opera INVENTARYA:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>Comprobantes de venta y facturas:</strong> Los registros contables y comprobantes emitidos deben conservarse durante un periodo legal de <strong>5 a 10 años</strong> para auditorías tributarias.
                  </li>
                  <li>
                    <strong>Historial de inventario y Kardex:</strong> Los movimientos de stock registrados quedan desvinculados de su identidad personal, preservando únicamente la integridad contable del negocio.
                  </li>
                </ul>
              </div>
            </AccordionItem>

            <AccordionItem
              key="employee-vs-owner"
              aria-label="Diferencia entre Empleados y Propietarios"
              title={<span className="text-xs sm:text-sm font-bold">Diferencia entre Empleados y Propietarios de Empresa</span>}
              startContent={<LuBuilding size={18} className="text-warning" />}
            >
              <div className="text-xs text-default-600 space-y-2 pb-2 leading-relaxed">
                <p>
                  <strong>Para Empleados y Colaboradores (Cajeros, Vendedores, Almaceneros):</strong><br />
                  La eliminación de la cuenta de un colaborador no elimina ni afecta la empresa ni los datos de sus compañeros de trabajo. La cuenta individual queda anulada de inmediato.
                </p>
                <p>
                  <strong>Para Propietarios (Dueños de Empresa):</strong><br />
                  La eliminación de la cuenta del propietario no destruye de manera unilateral la empresa, puesto que existen obligaciones con empleados y datos comerciales. Al confirmar la solicitud, el acceso queda suspendido y el equipo de soporte técnico coordina la transferencia de titularidad o el cierre y respaldo formal de la base de datos empresarial.
                </p>
              </div>
            </AccordionItem>
          </Accordion>
        </div>

      </div>
    </div>
  );
};
