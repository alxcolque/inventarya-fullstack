import { useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@nextui-org/react';
import {
  LuBell,
  LuCheckCheck,
  LuClock3,
  LuMoreVertical,
  LuPencil,
  LuPlus,
  LuSearch,
  LuSend,
  LuTrash2,
} from 'react-icons/lu';
import { ConfirmModal, DynamicBreadcrumbs } from '@/components';
import { NotificationFormModal } from '../components/NotificationFormModal';
import {
  ManagedNotification,
  NotificationSeverity,
} from '../interfaces/notification-management.interface';
import { useNotificationManagementStore } from '../store/notification-management.store';

const severityLabels: Record<NotificationSeverity, string> = {
  info: 'Informativa',
  success: 'Éxito',
  warning: 'Advertencia',
  critical: 'Crítica',
  danger: 'Crítica',
};

const severityColors: Record<
  NotificationSeverity,
  'primary' | 'success' | 'warning' | 'danger'
> = {
  info: 'primary',
  success: 'success',
  warning: 'warning',
  critical: 'danger',
  danger: 'danger',
};

export const NotificationManagementPage = () => {
  const {
    notifications,
    recipients,
    stats,
    pagination,
    isLoading,
    isSaving,
    fetchNotifications,
    fetchRecipients,
    fetchStats,
    deleteNotification,
  } = useNotificationManagementStore();

  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'read' | 'unread'>('all');
  const [severity, setSeverity] = useState<'all' | NotificationSeverity>('all');
  const [page, setPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selected, setSelected] = useState<ManagedNotification | null>(null);
  const [toDelete, setToDelete] = useState<ManagedNotification | null>(null);

  useEffect(() => {
    void Promise.all([fetchRecipients(), fetchStats()]);
  }, [fetchRecipients, fetchStats]);

  useEffect(() => {
    void fetchNotifications({ search, status, severity, page, per_page: 15 });
  }, [fetchNotifications, search, status, severity, page]);

  const openCreate = () => {
    setSelected(null);
    setIsFormOpen(true);
  };

  const openEdit = (notification: ManagedNotification) => {
    setSelected(notification);
    setIsFormOpen(true);
  };

  const applySearch = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const success = await deleteNotification(toDelete.id);
    if (success) {
      setToDelete(null);
      if (notifications.length === 1 && page > 1) setPage(page - 1);
    }
  };

  const statCards = [
    { label: 'Notificaciones', value: stats.total, icon: LuBell, color: 'text-primary', bg: 'bg-primary-50' },
    { label: 'Sin leer', value: stats.unread, icon: LuClock3, color: 'text-warning', bg: 'bg-warning-50' },
    { label: 'Leídas', value: stats.read, icon: LuCheckCheck, color: 'text-success', bg: 'bg-success-50' },
    { label: 'Enviadas hoy', value: stats.sent_today, icon: LuSend, color: 'text-secondary', bg: 'bg-secondary-50' },
  ];

  return (
    <div className='flex flex-col gap-6 animate-in fade-in duration-500'>
      <DynamicBreadcrumbs title="Gestión de Notificaciones" />

      <div className='flex flex-col md:flex-row md:items-end justify-between gap-4'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Gestión de notificaciones</h1>
          <p className='text-default-500 mt-1'>
            Envía avisos segmentados y administra el historial de entrega del tenant.
          </p>
        </div>
        <Button color='primary' variant='shadow' startContent={<LuPlus />} onPress={openCreate}>
          Nueva notificación
        </Button>
      </div>

      <div className='grid grid-cols-2 xl:grid-cols-4 gap-3'>
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className='border border-divider shadow-none'>
            <CardBody className='flex flex-row items-center gap-3 p-4'>
              <span className={'p-2.5 rounded-xl ' + bg + ' ' + color}>
                <Icon size={20} />
              </span>
              <div>
                <p className='text-2xl font-bold leading-none'>{value}</p>
                <p className='text-xs text-default-500 mt-1'>{label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className='border border-divider shadow-sm'>
        <CardBody className='p-0'>
          <div className='p-4 border-b border-divider flex flex-col lg:flex-row gap-3'>
            <Input
              isClearable
              className='lg:max-w-md'
              placeholder='Buscar por título, mensaje o destinatario...'
              startContent={<LuSearch className='text-default-400' />}
              value={searchDraft}
              onValueChange={(value) => {
                setSearchDraft(value);
                if (!value) {
                  setSearch('');
                  setPage(1);
                }
              }}
              onKeyDown={(event) => event.key === 'Enter' && applySearch()}
            />
            <Button variant='flat' onPress={applySearch}>Buscar</Button>
            <Select
              aria-label='Filtrar por estado'
              className='lg:max-w-48'
              selectedKeys={[status]}
              onSelectionChange={(keys) => {
                setStatus(String(Array.from(keys)[0]) as typeof status);
                setPage(1);
              }}
            >
              <SelectItem key='all'>Todos los estados</SelectItem>
              <SelectItem key='unread'>Sin leer</SelectItem>
              <SelectItem key='read'>Leídas</SelectItem>
            </Select>
            <Select
              aria-label='Filtrar por prioridad'
              className='lg:max-w-48'
              selectedKeys={[severity]}
              onSelectionChange={(keys) => {
                setSeverity(String(Array.from(keys)[0]) as typeof severity);
                setPage(1);
              }}
            >
              <SelectItem key='all'>Todas las prioridades</SelectItem>
              <SelectItem key='info'>Informativa</SelectItem>
              <SelectItem key='success'>Éxito</SelectItem>
              <SelectItem key='warning'>Advertencia</SelectItem>
              <SelectItem key='critical'>Crítica</SelectItem>
            </Select>
          </div>

          <Table
            removeWrapper
            aria-label='Historial de notificaciones administradas'
            classNames={{
              th: 'bg-default-50 text-default-500 font-bold',
              td: 'py-4',
            }}
          >
            <TableHeader>
              <TableColumn>NOTIFICACIÓN</TableColumn>
              <TableColumn>DESTINATARIO</TableColumn>
              <TableColumn>PRIORIDAD</TableColumn>
              <TableColumn>ESTADO</TableColumn>
              <TableColumn>FECHA</TableColumn>
              <TableColumn align='end'>ACCIONES</TableColumn>
            </TableHeader>
            <TableBody
              items={notifications}
              isLoading={isLoading}
              loadingContent={<p>Cargando notificaciones...</p>}
              emptyContent='No hay notificaciones que coincidan con los filtros.'
            >
              {(item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className='max-w-sm'>
                      <p className='font-semibold truncate'>{item.title}</p>
                      <p className='text-xs text-default-500 line-clamp-2'>{item.message}</p>
                      <span className='text-[10px] uppercase tracking-wide text-default-400'>
                        {item.type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.recipient ? (
                      <div className='flex items-center gap-2 min-w-48'>
                        <Avatar
                          size='sm'
                          name={item.recipient.name}
                          className='bg-primary-50 text-primary'
                        />
                        <div>
                          <p className='text-sm font-medium'>{item.recipient.name}</p>
                          <p className='text-xs text-default-400'>{item.recipient.email}</p>
                        </div>
                      </div>
                    ) : (
                      <span className='text-default-400'>Usuario eliminado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size='sm' variant='flat' color={severityColors[item.severity]}>
                      {severityLabels[item.severity]}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size='sm' variant='dot' color={item.read_at ? 'success' : 'warning'}>
                      {item.read_at ? 'Leída' : 'Pendiente'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className='text-xs whitespace-nowrap'>
                      <p>{new Date(item.created_at).toLocaleDateString('es-BO')}</p>
                      <p className='text-default-400'>
                        {new Date(item.created_at).toLocaleTimeString('es-BO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className='flex justify-end'>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button isIconOnly size='sm' variant='light' aria-label='Abrir acciones'>
                            <LuMoreVertical />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label='Acciones de notificación'>
                          <DropdownItem
                            key='edit'
                            startContent={<LuPencil />}
                            onPress={() => openEdit(item)}
                          >
                            Editar
                          </DropdownItem>
                          <DropdownItem
                            key='delete'
                            color='danger'
                            className='text-danger'
                            startContent={<LuTrash2 />}
                            onPress={() => setToDelete(item)}
                          >
                            Eliminar
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {pagination.last_page > 1 && (
            <div className='flex justify-between items-center p-4 border-t border-divider'>
              <p className='text-xs text-default-500'>{pagination.total} registros</p>
              <Pagination
                showControls
                page={pagination.current_page}
                total={pagination.last_page}
                onChange={setPage}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <NotificationFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        notification={selected}
        recipients={recipients}
      />

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        isLoading={isSaving}
        title='Eliminar notificación'
        description={
          'Se eliminará definitivamente la notificación enviada a ' +
          (toDelete?.recipient?.name || 'este destinatario') +
          '.'
        }
      />
    </div>
  );
};
