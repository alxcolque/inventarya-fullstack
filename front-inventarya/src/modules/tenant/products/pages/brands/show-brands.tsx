import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Skeleton,
} from "@nextui-org/react";
import { LuArrowLeft, LuTag, LuHash } from "react-icons/lu";
import { DynamicBreadcrumbs } from "@/components";
import { useBrandsStore } from "../../store/brands/brands.store";
import { getBrandImageUrl } from "./components/BrandModal";

export const ShowBrands = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const brand = useBrandsStore((state) => state.brand);
  const isLoading = useBrandsStore((state) => state.isLoading);
  const getBrand = useBrandsStore((state) => state.getBrand);

  useEffect(() => {
    if (id) {
      getBrand(id);
    }
  }, [id, getBrand]);

  const imageUrl = getBrandImageUrl(brand?.image);

  return (
    <div className="my-2 px-2 sm:px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4 pb-12">
      <DynamicBreadcrumbs title={brand?.name || "Detalle de Marca"} />

      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="flat"
          startContent={<LuArrowLeft size={16} />}
          onPress={() => navigate("/brands")}
          className="text-xs font-semibold"
        >
          Volver a Marcas
        </Button>
      </div>

      <Card className="border-none shadow-sm rounded-3xl bg-content1 overflow-hidden max-w-2xl">
        <CardBody className="p-6 flex flex-col gap-6">
          {isLoading || !brand ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-6 w-1/3 rounded-lg" />
              <Skeleton className="h-4 w-1/2 rounded-lg" />
            </div>
          ) : (
            <>
              {/* Logo / Banner */}
              {imageUrl ? (
                <div className="flex items-center justify-center p-6 rounded-2xl bg-default-50 border border-divider/40">
                  <img
                    src={imageUrl}
                    alt={brand.name}
                    className="max-h-44 max-w-full object-contain rounded-lg"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center p-8 rounded-2xl bg-default-50 border border-divider/40 text-default-400">
                  <LuTag size={48} />
                </div>
              )}

              {/* Info Detallada */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-default-900">{brand.name}</h2>
                  <Chip
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<LuHash size={12} className="ml-1" />}
                    className="text-xs font-mono h-6"
                  >
                    ID: {brand.id}
                  </Chip>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div className="p-3 rounded-2xl bg-default-100/50 flex flex-col">
                    <span className="text-[11px] font-semibold text-default-400 uppercase">
                      Slug identificador
                    </span>
                    <span className="text-xs font-mono text-default-800 mt-0.5">
                      {brand.slug}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-default-100/50 flex flex-col">
                    <span className="text-[11px] font-semibold text-default-400 uppercase">
                      Logotipo registrado
                    </span>
                    <span className="text-xs text-default-800 mt-0.5">
                      {brand.image ? "Sí, personalizado" : "Sin logotipo asignado"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
