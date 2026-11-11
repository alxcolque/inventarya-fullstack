import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Textarea,
  Divider,
} from '@nextui-org/react';
import {
  LuUserX,
  LuShieldAlert,
  LuMail,
  LuAlertTriangle,
  LuCheckCircle2,
  LuClock,
  LuBuilding,
  LuExternalLink,
} from 'react-icons/lu';
import { useTenantAuthStore } from '@/modules/auth/store/tenantAuth.store';
import {
  accountDeletionApi,
  TenantMyStatusItem,
} from '@/api/accountDeletionApi';
import { toast } from 'sonner';

interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountDeletionModal: React.FC<AccountDeletionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const user = useTenantAuthStore((state) => state.user);
  const isOwner = user?.role === 'owner';

  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRequests, setActiveRequests] = useState<TenantMyStatusItem[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  // Fetch current user's request status when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadUserStatus();
    } else {
      setSubmittedTicket(null);
      setReason('');
    }
  }, [isOpen, user]);

  const loadUserStatus = async () => {
    try {
      setIsLoadingStatus(true);
      const res = await accountDeletionApi.getMyTenantStatus();
      if (res.success && res.requests) {
        setActiveRequests(res.requests);
      }
    } catch {
      // Ignored if user has no prior requests
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleSendRequest = async () => {
    try {
      setIsSubmitting(true);
      const res = await accountDeletionApi.requestAuthenticatedTenantDeletion(
        reason.trim() || undefined
      );

      if (res.ticket) {
        setSubmittedTicket(res.ticket);
      }
      toast.success(res.message);
      void loadUserStatus();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Error al procesar la solicitud de eliminación. Intente de nuevo.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const latestPending = activeRequests.find(
    (r) => r.status === 'pending_verification'
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      backdrop="blur"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-danger-500/10 text-danger border border-danger-500/20">
              <LuUserX size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Solicitar Eliminación de Cuenta
              </h2>
              <p className="text-xs text-default-500 font-normal">
                Procedimiento de privacidad y derecho al olvido conforme a Google Play
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-4 py-2">
          {/* User profile summary */}
          <div className="p-3.5 rounded-xl bg-content2 border border-divider flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">{user?.name}</span>
              <span className="text-[11px] text-default-500">{user?.email}</span>
            </div>
            <Chip
              size="sm"
              variant="flat"
              color={isOwner ? 'warning' : 'primary'}
              className="capitalize text-[11px] font-semibold"
            >
              {isOwner ? 'Propietario de Empresa' : `Rol: ${user?.role || 'Colaborador'}`}
            </Chip>
          </div>

          {/* Active Request Alert if pending */}
          {latestPending && (
            <div className="p-3.5 rounded-xl bg-warning-500/10 border border-warning-500/20 space-y-2">
              <div className="flex items-center gap-2 text-warning-700 dark:text-warning-400 font-bold text-xs">
                <LuClock size={16} />
                <span>Tiene una solicitud de eliminación pendiente de verificación</span>
              </div>
              <p className="text-[11px] text-default-600">
                Ticket: <strong className="font-mono text-foreground">{latestPending.ticket}</strong>.
                Revise la bandeja de entrada de su correo electrónico para confirmar el enlace antes de su expiración.
              </p>
            </div>
          )}

          {submittedTicket && (
            <div className="p-3.5 rounded-xl bg-success-500/10 border border-success-500/20 space-y-2">
              <div className="flex items-center gap-2 text-success font-bold text-xs">
                <LuCheckCircle2 size={16} />
                <span>Enlace de confirmación enviado exitosamente</span>
              </div>
              <p className="text-[11px] text-default-600">
                Hemos enviado las instrucciones a <strong>{user?.email}</strong>.
                Ticket generado: <strong className="font-mono text-foreground">{submittedTicket}</strong>.
              </p>
            </div>
          )}

          {/* Detailed explanation depending on role */}
          {isOwner ? (
            <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 space-y-2.5">
              <div className="flex items-center gap-2 text-danger font-bold text-xs">
                <LuShieldAlert size={18} />
                <span>Condiciones especiales para Propietarios de Empresa</span>
              </div>
              <div className="text-xs text-default-600 space-y-1.5 leading-relaxed">
                <p>
                  Como propietario, usted es el titular de la suscripción y de los datos comerciales de la empresa.
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    La eliminación directa no destruirá unilateralmente la base de datos empresarial de INVENTARYA para no perjudicar a sus empleados o clientes.
                  </li>
                  <li>
                    Al confirmar la solicitud por correo, su sesión será suspendida y el caso se remitirá a <strong>Revisión de Soporte Técnico</strong> para coordinar la transferencia de titularidad o el cierre y respaldo formal de la empresa.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-default-100/80 border border-divider space-y-2.5">
              <div className="flex items-center gap-2 text-foreground font-bold text-xs">
                <LuAlertTriangle size={16} className="text-warning" />
                <span>Alcance de la eliminación para Colaboradores</span>
              </div>
              <div className="text-xs text-default-600 space-y-1.5 leading-relaxed">
                <ul className="list-disc pl-4 space-y-1">
                  <li>Se revocarán inmediatamente todas sus sesiones y credenciales de acceso.</li>
                  <li>Se eliminarán sus dispositivos móviles asociados (tokens FCM en Android).</li>
                  <li>Sus datos personales serán permanentemente anonimizados.</li>
                  <li>
                    <strong>Conservación legal:</strong> Los comprobantes y ventas registradas durante su labor se mantendrán por 5 a 10 años para auditoría fiscal del negocio, sin vincularse a su identidad personal.
                  </li>
                  <li>La empresa y las cuentas del resto del equipo no serán afectadas.</li>
                </ul>
              </div>
            </div>
          )}

          {/* Feedback textarea */}
          {!submittedTicket && !latestPending && (
            <div className="space-y-1">
              <Textarea
                size="sm"
                label="Motivo de la solicitud (Opcional)"
                placeholder="Indique brevemente el motivo para ayudarnos a mejorar..."
                labelPlacement="outside"
                minRows={2}
                value={reason}
                onValueChange={setReason}
              />
            </div>
          )}

          {/* Public Portal Reference */}
          <div className="pt-1 flex items-center justify-between text-xs text-default-500 border-t border-divider pt-3">
            <span>¿Prefiere gestionarlo públicamente?</span>
            <Button
              as="a"
              href="/delete-account"
              target="_blank"
              size="sm"
              variant="light"
              className="text-primary text-xs h-7"
              endContent={<LuExternalLink size={13} />}
            >
              Portal Público /delete-account
            </Button>
          </div>
        </ModalBody>

        <ModalFooter className="border-t border-divider pt-3">
          <Button
            size="sm"
            variant="flat"
            onPress={onClose}
          >
            Cerrar
          </Button>

          {!latestPending && !submittedTicket && (
            <Button
              size="sm"
              color="danger"
              isLoading={isSubmitting}
              onPress={handleSendRequest}
              className="font-bold"
              startContent={!isSubmitting && <LuMail size={15} />}
            >
              Enviar Enlace de Verificación
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
