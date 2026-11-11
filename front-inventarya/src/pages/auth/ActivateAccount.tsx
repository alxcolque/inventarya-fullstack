import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Spinner,
} from '@nextui-org/react';
import {
  LuCheck,
  LuAlertTriangle,
  LuEye,
  LuEyeOff,
  LuLock,
  LuLogIn,
  LuShieldCheck,
} from 'react-icons/lu';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { tenantApi } from '@/api';

interface InvitationDetails {
  name: string;
  email: string;
  tenant_name: string;
  expires_at: string;
}

type PageState = 'loading' | 'ready' | 'invalid' | 'success';

export default function ActivateAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hashToken = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
    : null;
  const token = searchParams.get('token') || hashToken || '';
  const [pageState, setPageState] = useState<PageState>('loading');
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const validateInvitation = async () => {
      if (token.length !== 64) {
        setPageState('invalid');
        return;
      }

      try {
        const { data } = await tenantApi.post<{ data: InvitationDetails }>(
          '/account-invitations/validate',
          { token }
        );
        setDetails(data.data);
        setPageState('ready');
      } catch {
        setPageState('invalid');
      }
    };

    void validateInvitation();
  }, [token]);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      letter: /[a-zA-Z]/.test(password),
      number: /\d/.test(password),
      matches: password.length > 0 && password === confirmation,
    }),
    [password, confirmation]
  );

  const isValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { data } = await tenantApi.post('/account-invitations/activate', {
        token,
        password,
        password_confirmation: confirmation,
      });
      toast.success(data.message);
      setPageState('success');
    } catch (error) {
      const message = isAxiosError(error)
        ? error.response?.data?.message ||
        error.response?.data?.errors?.token?.[0] ||
        error.response?.data?.errors?.password?.[0]
        : null;
      toast.error(message || 'No se pudo activar la cuenta.');
      if (isAxiosError(error) && error.response?.data?.errors?.token) {
        setPageState('invalid');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageState === 'loading') {
    return (
      <div className='flex flex-col items-center gap-3 text-default-500'>
        <Spinner size='lg' />
        <p>Validando invitación segura...</p>
      </div>
    );
  }

  if (pageState === 'invalid') {
    return (
      <Card className='w-full max-w-md border border-divider shadow-lg rounded-3xl'>
        <CardBody className='items-center text-center gap-4 p-8'>
          <span className='p-4 rounded-full bg-danger-50 text-danger'>
            <LuAlertTriangle size={32} />
          </span>
          <div>
            <h1 className='text-xl font-bold'>Invitación no disponible</h1>
            <p className='text-sm text-default-500 mt-2'>
              El enlace es inválido, ya fue utilizado o ha expirado. Solicita una nueva invitación al administrador de la tienda.
            </p>
          </div>
          <Button color='primary' variant='flat' onPress={() => navigate('/login')}>
            Volver al inicio de sesión
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (pageState === 'success') {
    return (
      <Card className='w-full max-w-md border border-divider shadow-lg rounded-3xl'>
        <CardBody className='items-center text-center gap-4 p-8'>
          <span className='p-4 rounded-full bg-success-50 text-success'>
            <LuShieldCheck size={34} />
          </span>
          <div>
            <h1 className='text-xl font-bold'>Cuenta activada</h1>
            <p className='text-sm text-default-500 mt-2'>
              Tu contraseña quedó configurada. Ya puedes ingresar con {details?.email}.
            </p>
          </div>
          <Button
            color='primary'
            startContent={<LuLogIn />}
            onPress={() => navigate('/login', { replace: true })}
          >
            Iniciar sesión
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className='w-full max-w-lg border border-divider shadow-lg rounded-3xl p-2 sm:p-4'>
      <CardHeader className='flex flex-col items-center text-center gap-3 pt-6'>
        <span className='p-3 rounded-2xl bg-primary-50 text-primary'>
          <LuLock size={28} />
        </span>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wider text-primary'>
            {details?.tenant_name}
          </p>
          <h1 className='text-2xl font-black mt-1'>Activa tu cuenta</h1>
          <p className='text-sm text-default-500 mt-2'>
            Hola, {details?.name}. Define la contraseña que usarás para iniciar sesión.
          </p>
        </div>
      </CardHeader>

      <CardBody className='py-5'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <Input label='Correo' value={details?.email || ''} isReadOnly variant='flat' />
          <Input
            isRequired
            label='Nueva Contraseña'
            type={showPassword ? 'text' : 'password'}
            value={password}
            onValueChange={setPassword}
            autoComplete='new-password'
            startContent={<LuLock className='text-default-400' />}
            endContent={
              <button
                type='button'
                aria-label='Alternar visibilidad de contraseña'
                onClick={() => setShowPassword((current) => !current)}
                className='text-default-400'
              >
                {showPassword ? <LuEyeOff /> : <LuEye />}
              </button>
            }
          />
          <Input
            isRequired
            label='Confirmar contraseña'
            type={showPassword ? 'text' : 'password'}
            value={confirmation}
            onValueChange={setConfirmation}
            autoComplete='new-password'
            isInvalid={confirmation.length > 0 && !passwordChecks.matches}
            errorMessage='Las contraseñas no coinciden.'
          />

          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs'>
            {[
              ['Mínimo 8 caracteres', passwordChecks.length],
              ['Al menos una letra', passwordChecks.letter],
              ['Al menos un número', passwordChecks.number],
              ['Las contraseñas coinciden', passwordChecks.matches],
            ].map(([label, valid]) => (
              <span
                key={String(label)}
                className={valid ? 'flex items-center gap-1.5 text-success' : 'flex items-center gap-1.5 text-default-400'}
              >
                <LuCheck size={13} /> {label}
              </span>
            ))}
          </div>

          <Button
            type='submit'
            color='primary'
            size='lg'
            isDisabled={!isValid}
            isLoading={isSubmitting}
            startContent={!isSubmitting && <LuShieldCheck />}
            className='font-bold mt-2'
          >
            Activar cuenta
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
