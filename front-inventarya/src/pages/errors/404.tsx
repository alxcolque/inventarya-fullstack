


import { useRouteError, useNavigate } from "react-router-dom";
import { Button } from "@nextui-org/react";
import { FaHome, FaStore, FaChartLine, FaArrowLeft } from "react-icons/fa";

export const ErrorPage = () => {
  const error: any = useRouteError();
  const navigate = useNavigate();

  console.error("Router error captured by ErrorPage:", error);

  const errorMessage =
    error?.statusText ||
    error?.message ||
    error?.data ||
    (typeof error === "string" ? error : "Página no encontrada");

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-12">
      <div className="bg-default-50 border border-default-200 shadow-xl rounded-3xl p-8 max-w-lg w-full text-center flex flex-col items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-danger-100 text-danger-600 flex items-center justify-center text-4xl font-black shadow-inner">
          404
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Página o Recurso No Encontrado
          </h1>
          <p className="text-default-500 text-sm">
            La ruta a la que intentas acceder no existe o fue movida.
          </p>
          {errorMessage && errorMessage !== "Página no encontrada" && (
            <p className="text-xs font-mono bg-default-100 text-default-600 p-2 rounded-lg break-all mt-1">
              {String(errorMessage)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 w-full pt-2">
          <Button
            size="sm"
            variant="flat"
            color="primary"
            startContent={<FaStore />}
            onPress={() => navigate("/shops")}
            className="font-semibold"
          >
            Ir a Sucursales / POS
          </Button>
          <Button
            size="sm"
            variant="flat"
            color="secondary"
            startContent={<FaChartLine />}
            onPress={() => navigate("/dashboard")}
            className="font-semibold"
          >
            Dashboard
          </Button>
          <Button
            size="sm"
            variant="light"
            startContent={<FaArrowLeft />}
            onPress={() => navigate(-1)}
            className="font-semibold"
          >
            Regresar
          </Button>
        </div>
      </div>
    </div>
  );
};
