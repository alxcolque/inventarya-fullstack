import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Button, Card, CardBody, Chip } from '@nextui-org/react';
import { LuAlertTriangle, LuRefreshCw, LuHome } from 'react-icons/lu';

export const RootErrorBoundary: React.FC = () => {
  const error = useRouteError();

  let errorMessage = 'Ha ocurrido un error inesperado en la aplicación.';
  let errorStatus: number | string = 'Error';

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || errorMessage;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
      <Card className="max-w-lg w-full border border-divider shadow-xl bg-content1/90 backdrop-blur-md">
        <CardBody className="p-8 flex flex-col items-center text-center gap-5">
          <div className="p-4 rounded-2xl bg-danger-50 text-danger border border-danger-200 shadow-sm">
            <LuAlertTriangle size={36} />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <Chip size="sm" color="danger" variant="flat" className="font-semibold text-xs uppercase">
              {String(errorStatus)}
            </Chip>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Algo no salió como esperábamos
            </h2>
            <p className="text-default-500 text-xs sm:text-sm mt-1 max-w-sm">
              La aplicación encontró una dificultad temporal al procesar esta vista.
            </p>
          </div>

          <div className="w-full p-3.5 rounded-xl bg-content2 border border-divider text-left font-mono text-xs text-default-600 break-all max-h-36 overflow-y-auto">
            {errorMessage}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center mt-2">
            <Button
              color="primary"
              variant="solid"
              className="w-full sm:w-auto font-semibold px-6"
              startContent={<LuRefreshCw size={16} />}
              onPress={handleReload}
            >
              Recargar página
            </Button>
            <Button
              variant="bordered"
              className="w-full sm:w-auto font-semibold px-6 border-divider"
              startContent={<LuHome size={16} />}
              onPress={handleGoHome}
            >
              Ir al Inicio
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
