import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Skeleton,
} from "@nextui-org/react";
import {
  LuFolder,
  LuArrowLeft,
  LuPencil,
  LuGitBranch,
  LuPackage,
  LuPalette,
  LuLayers,
} from "react-icons/lu";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useCategoriesStore } from "../../store/categories/categories.store";
import { CategoryModal } from "./components/CategoryModal";

export const ShowCategories = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const token = useTenantAuthStore((state) => state.token);
  const can = useTenantAuthStore((state) => state.can);
  const canUpdate = can("categories:update");

  const category = useCategoriesStore((state) => state.category);
  const categories = useCategoriesStore((state) => state.categories);
  const getCategory = useCategoriesStore((state) => state.getCategory);
  const getCategories = useCategoriesStore((state) => state.getCategories);
  const updateCategory = useCategoriesStore((state) => state.updateCategory);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        setIsLoading(true);
        await Promise.all([
          getCategory(Number(id), token!),
          getCategories(token!),
        ]);
        setIsLoading(false);
      }
    };
    fetchData();
  }, [id, getCategory, getCategories, token]);

  const handleEditSubmit = async (formData: { name: string; parent_id: number | null; color: string }) => {
    if (!category?.id) return false;
    const success = await updateCategory(Number(category.id), formData, token!);
    if (success) {
      await getCategory(Number(category.id), token!);
      setIsEditModalOpen(false);
      return true;
    }
    return false;
  };

  if (isLoading) {
    return (
      <div className="my-3 px-4 lg:px-8 max-w-[95rem] mx-auto w-full flex flex-col gap-6">
        <DynamicBreadcrumbs title="Detalle de Categoría" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!category || !category.id) {
    return (
      <div className="my-6 px-4 lg:px-8 max-w-[95rem] mx-auto w-full flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="p-8 rounded-3xl bg-default-50 border border-default-200 text-center max-w-md flex flex-col items-center gap-3">
          <LuFolder size={48} className="text-default-400" />
          <h2 className="text-xl font-bold text-default-800">Categoría no encontrada</h2>
          <p className="text-sm text-default-500">
            La categoría solicitada no existe o fue eliminada del catálogo.
          </p>
          <Button
            color="primary"
            variant="flat"
            startContent={<LuArrowLeft size={16} />}
            onPress={() => navigate("/categories")}
          >
            Volver al listado de categorías
          </Button>
        </div>
      </div>
    );
  }

  const isSub = Boolean(category.parent_id);

  return (
    <div className="my-3 px-4 lg:px-8 max-w-[95rem] mx-auto w-full flex flex-col gap-6 animate-fadeIn pb-12">
      <DynamicBreadcrumbs title={category?.name || "Detalle de Categoría"} />

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-default-50 dark:bg-default-100/20 p-4 lg:p-6 rounded-3xl border border-default-200/60 dark:border-default-100/20">
        <div className="flex items-center gap-4">
          <Button
            isIconOnly
            variant="light"
            radius="full"
            onPress={() => navigate("/categories")}
            aria-label="Volver a categorías"
            className="text-default-600 hover:text-default-900"
          >
            <LuArrowLeft size={22} />
          </Button>

          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: category.color || "#6366f1" }}
          >
            <LuFolder size={24} />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-default-900">
                {category.name}
              </h1>
              <Chip
                size="sm"
                variant="flat"
                color={isSub ? "secondary" : "primary"}
                className="font-semibold text-xs"
              >
                {isSub ? `Subcategoría de: ${category.parent_name}` : "Categoría Principal"}
              </Chip>
            </div>
            <p className="text-xs text-default-400 font-mono mt-1">
              slug: {category.slug}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {canUpdate && (
            <Button
              color="default"
              variant="flat"
              radius="lg"
              startContent={<LuPencil size={17} />}
              onPress={() => setIsEditModalOpen(true)}
              className="font-medium hover:bg-default-200"
            >
              Editar Categoría
            </Button>
          )}
          <Button
            color="primary"
            variant="solid"
            radius="lg"
            startContent={<LuPackage size={17} />}
            onPress={() => navigate("/products")}
            className="font-semibold shadow-sm"
          >
            Ver Productos
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Jerarquía */}
        <Card className="border border-default-200/60 dark:border-default-100/20 shadow-sm">
          <CardHeader className="px-5 py-4 border-b border-default-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/40 text-primary">
              <LuGitBranch size={20} />
            </div>
            <h3 className="font-bold text-default-900 text-base">Estructura Jerárquica</h3>
          </CardHeader>
          <CardBody className="p-5 flex flex-col gap-3">
            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Tipo
              </span>
              <p className="text-sm font-semibold text-default-900">
                {isSub ? "Subcategoría" : "Categoría Raíz / Principal"}
              </p>
            </div>

            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Ruta Completa
              </span>
              <p className="font-mono text-xs bg-default-100 dark:bg-default-100/30 p-2.5 rounded-xl text-default-800">
                {category.full_path || category.name}
              </p>
            </div>

            {category.parent_name && (
              <div>
                <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                  Categoría Superior
                </span>
                <span className="text-xs font-semibold text-primary">
                  {category.parent_name}
                </span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Color y Estilo */}
        <Card className="border border-default-200/60 dark:border-default-100/20 shadow-sm">
          <CardHeader className="px-5 py-4 border-b border-default-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <LuPalette size={20} />
            </div>
            <h3 className="font-bold text-default-900 text-base">Color e Identidad</h3>
          </CardHeader>
          <CardBody className="p-5 flex flex-col gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Color Asignado
              </span>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-default-50 border border-default-100">
                <span
                  className="w-8 h-8 rounded-xl border border-default-200 shadow-sm"
                  style={{ backgroundColor: category.color || "#6366f1" }}
                />
                <span className="font-mono text-sm font-bold text-default-900 uppercase">
                  {category.color || "#6366F1"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs uppercase font-bold text-default-400 block mb-1">
                Ejemplo de Etiqueta
              </span>
              <Chip
                variant="solid"
                className="text-white font-semibold shadow-xs"
                style={{ backgroundColor: category.color || "#6366f1" }}
              >
                {category.name}
              </Chip>
            </div>
          </CardBody>
        </Card>

        {/* Productos y Subcategorías */}
        <Card className="border border-default-200/60 dark:border-default-100/20 shadow-sm">
          <CardHeader className="px-5 py-4 border-b border-default-100 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <LuLayers size={20} />
            </div>
            <h3 className="font-bold text-default-900 text-base">Catálogo Asociado</h3>
          </CardHeader>
          <CardBody className="p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-default-50 border border-default-100">
              <span className="text-xs font-semibold text-default-600">Productos en esta categoría</span>
              <Chip size="sm" color="success" variant="flat" className="font-bold font-mono">
                {category.product_count ?? 0}
              </Chip>
            </div>

            {category.children && category.children.length > 0 && (
              <div>
                <span className="text-xs uppercase font-bold text-default-400 block mb-1.5">
                  Subcategorías Directas ({category.children.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {category.children.map((child: any) => (
                    <Chip
                      key={child.id}
                      size="sm"
                      variant="bordered"
                      className="cursor-pointer hover:border-primary text-xs"
                      onClick={() => navigate(`/categories/${child.id}`)}
                    >
                      {child.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Modal de edición */}
      {isEditModalOpen && (
        <CategoryModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={handleEditSubmit}
          initialData={category}
          categories={categories}
          isEditing={true}
        />
      )}
    </div>
  );
};
