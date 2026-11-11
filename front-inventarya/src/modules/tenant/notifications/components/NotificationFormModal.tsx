import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Textarea,
} from '@nextui-org/react';
import { LuBell, LuLink, LuSearch, LuSend } from 'react-icons/lu';
import {
  ManagedNotification,
  NotificationFormData,
  NotificationRecipient,
} from '../interfaces/notification-management.interface';
import { useNotificationManagementStore } from '../store/notification-management.store';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notification?: ManagedNotification | null;
  recipients: NotificationRecipient[];
}

const initialForm: NotificationFormData = {
  title: '',
  message: '',
  type: 'general',
  severity: 'info',
  action_url: '',
  audience: 'all',
  recipient_roles: [],
  user_ids: [],
};

export const NotificationFormModal = ({
  isOpen,
  onClose,
  notification,
  recipients,
}: Props) => {
  const { createNotification, updateNotification, isSaving } =
    useNotificationManagementStore();
  const [form, setForm] = useState<NotificationFormData>(initialForm);
  const [recipientSearch, setRecipientSearch] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setRecipientSearch('');
    setForm(
      notification
        ? {
            title: notification.title,
            message: notification.message,
            type: notification.type,
            severity: notification.severity,
            action_url: notification.action_url || '',
            audience: 'users',
            user_ids: notification.recipient ? [notification.recipient.id] : [],
          }
        : initialForm
    );
  }, [isOpen, notification]);

  const setField = <K extends keyof NotificationFormData>(
    field: K,
    value: NotificationFormData[K]
  ) => setForm((current) => ({ ...current, [field]: value }));

  const isAudienceValid =
    !!notification ||
    form.audience === 'all' ||
    form.audience === 'admins' ||
    (form.audience === 'roles' && !!form.recipient_roles?.length) ||
    (form.audience === 'users' && !!form.user_ids?.length);

  const isValid =
    form.title.trim().length > 0 &&
    form.message.trim().length > 0 &&
    isAudienceValid;
  const filteredRecipients = recipients.filter((recipient) => {
    const term = recipientSearch.trim().toLowerCase();
    if (!term) return true;

    return [recipient.name, recipient.email, recipient.role]
      .some((value) => value.toLowerCase().includes(term));
  });

  const handleSubmit = async () => {
    if (!isValid) return;

    const payload: NotificationFormData = {
      title: form.title.trim(),
      message: form.message.trim(),
      type: form.type,
      severity: form.severity,
      action_url: form.action_url?.trim() || null,
      audience: form.audience,
      ...(form.audience === 'roles'
        ? { recipient_roles: form.recipient_roles }
        : {}),
      ...(form.audience === 'users'
        ? { user_ids: form.user_ids }
        : {}),
    };

    const success = notification
      ? await updateNotification(notification.id, {
          title: payload.title,
          message: payload.message,
          type: payload.type,
          severity: payload.severity,
          action_url: payload.action_url,
        })
      : await createNotification(payload);

    if (success) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size='3xl' scrollBehavior='inside' backdrop='blur'>
      <ModalContent>
        <ModalHeader className='flex items-center gap-3 border-b border-divider'>
          <span className='p-2 rounded-xl bg-primary-50 text-primary'>
            <LuBell size={20} />
          </span>
          <div>
            <p className='text-lg font-bold'>
              {notification ? 'Editar notificación' : 'Nueva notificación'}
            </p>
            <p className='text-xs font-normal text-default-500'>
              {notification
                ? 'Actualiza la copia enviada a este destinatario.'
                : 'Redacta y selecciona la audiencia que recibirá el aviso.'}
            </p>
          </div>
        </ModalHeader>

        <ModalBody className='py-6 gap-5'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <Input
              isRequired
              label='Título'
              labelPlacement='outside'
              placeholder='Ej. Mantenimiento programado'
              value={form.title}
              maxLength={150}
              onValueChange={(value) => setField('title', value)}
            />
            <Select
              label='Tipo'
              labelPlacement='outside'
              selectedKeys={[form.type]}
              onSelectionChange={(keys) => setField('type', String(Array.from(keys)[0]))}
            >
              <SelectItem key='general'>General</SelectItem>
              <SelectItem key='announcement'>Anuncio</SelectItem>
              <SelectItem key='inventory'>Inventario</SelectItem>
              <SelectItem key='sales'>Ventas</SelectItem>
              <SelectItem key='system'>Sistema</SelectItem>
            </Select>
          </div>

          <Textarea
            isRequired
            label='Mensaje'
            labelPlacement='outside'
            placeholder='Escribe un mensaje claro para los destinatarios...'
            value={form.message}
            maxLength={1000}
            minRows={4}
            onValueChange={(value) => setField('message', value)}
            description={form.message.length + '/1000 caracteres'}
          />

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <Select
              label='Prioridad'
              labelPlacement='outside'
              selectedKeys={[form.severity]}
              onSelectionChange={(keys) =>
                setField('severity', String(Array.from(keys)[0]) as NotificationFormData['severity'])
              }
            >
              <SelectItem key='info'>Informativa</SelectItem>
              <SelectItem key='success'>Éxito</SelectItem>
              <SelectItem key='warning'>Advertencia</SelectItem>
              <SelectItem key='critical'>Crítica</SelectItem>
            </Select>
            <Input
              label='Ruta de acción (opcional)'
              labelPlacement='outside'
              placeholder='/inventories'
              startContent={<LuLink className='text-default-400' />}
              value={form.action_url || ''}
              onValueChange={(value) => setField('action_url', value)}
            />
          </div>

          {!notification && (
            <div className='rounded-xl border border-divider p-4 space-y-4'>
              <Select
                label='Audiencia'
                labelPlacement='outside'
                selectedKeys={[form.audience]}
                onSelectionChange={(keys) =>
                  setField('audience', String(Array.from(keys)[0]) as NotificationFormData['audience'])
                }
              >
                <SelectItem key='all'>Todos los usuarios activos</SelectItem>
                <SelectItem key='admins'>Propietarios y administradores</SelectItem>
                <SelectItem key='roles'>Roles específicos</SelectItem>
                <SelectItem key='users'>Usuarios específicos</SelectItem>
              </Select>

              {form.audience === 'roles' && (
                <CheckboxGroup
                  label='Roles destinatarios'
                  orientation='horizontal'
                  value={form.recipient_roles || []}
                  onValueChange={(value) => setField('recipient_roles', value)}
                >
                  <Checkbox value='owner'>Propietarios</Checkbox>
                  <Checkbox value='admin'>Administradores</Checkbox>
                  <Checkbox value='staff'>Personal</Checkbox>
                </CheckboxGroup>
              )}

              {form.audience === 'users' && (
                <div className='space-y-3'>
                  <Input
                    label='Buscar usuarios'
                    labelPlacement='outside'
                    placeholder='Nombre, correo o rol...'
                    value={recipientSearch}
                    onValueChange={setRecipientSearch}
                    startContent={<LuSearch className='text-default-400' />}
                  />
                  <Select
                    label='Destinatarios'
                    labelPlacement='outside'
                    selectionMode='multiple'
                    placeholder='Selecciona uno o más usuarios'
                    selectedKeys={new Set((form.user_ids || []).map(String))}
                    onSelectionChange={(keys) => {
                      if (keys === 'all') {
                        setField('user_ids', filteredRecipients.map((user) => user.id));
                        return;
                      }
                      setField('user_ids', Array.from(keys).map((key) => Number(key)));
                    }}
                  >
                    {filteredRecipients.map((user) => (
                      <SelectItem key={String(user.id)} textValue={user.name}>
                        <div className='flex flex-col'>
                          <span>{user.name}</span>
                          <span className='text-xs text-default-400'>
                            {user.email} · {user.role}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                  <Chip size='sm' color={form.user_ids?.length ? 'primary' : 'default'} variant='flat'>
                    {form.user_ids?.length || 0} usuario(s) seleccionado(s)
                  </Chip>
                </div>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter className='border-t border-divider'>
          <Button variant='light' onPress={onClose}>Cancelar</Button>
          <Button
            color='primary'
            startContent={!isSaving && <LuSend />}
            isLoading={isSaving}
            isDisabled={!isValid}
            onPress={handleSubmit}
          >
            {notification ? 'Guardar cambios' : 'Enviar notificación'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
