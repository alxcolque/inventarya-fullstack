import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Chip,
  Tooltip,
  Card,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Skeleton,
} from "@nextui-org/react";
import {
  LuFolder,
  LuFolderPlus,
  LuSearch,
  LuPencil,
  LuTrash2,
  LuEye,
  LuGitBranch,
  LuCornerDownRight,
  LuAlertTriangle,
  LuPlus,
} from "react-icons/lu";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useCategoriesStore } from "../../store/categories/categories.store";
import { CategoryDnd, CategoryDragHandle } from './components/CategoryDnd';
import { categoryMoveError, sameId } from '../../utils/categoryHierarchy';
import { CategoryModal } from "./components/CategoryModal";
import { ICategoryResponse } from "@/interface";

interface HierarchicalCategory extends ICategoryResponse {
  level: number;
  hasChildren: boolean;
}

// Función para construir la jerarquía recursiva (árbol ordenado en profundidad)
const buildCategoryTree = (
  items: ICategoryResponse[],
  parentId: number | string | null = null,
  level = 0
): HierarchicalCategory[] => {
  const directChildren = items.filter((item) => {
    if (parentId === null || parentId === "") {
      return !item.parent_id;
    }
    return String(item.parent_id) === String(parentId);
  });

  // Ordenar alfabéticamente dentro del mismo nivel
  directChildren.sort((a, b) => a.name.localeCompare(b.name));

  let result: HierarchicalCategory[] = [];

  directChildren.forEach((child) => {
    const grandChildren = items.filter(
      (item) => String(item.parent_id) === String(child.id)
    );

    result.push({
      ...child,
      level,
      hasChildren: grandChildren.length > 0,
    });

    if (grandChildren.length > 0) {
      result = result.concat(buildCategoryTree(items, child.id, level + 1));
    }
  });

  return result;
};

export const IndexCategories = () => {
  const navigate = useNavigate();
  const token = useTenantAuthStore((state) => state.token);
  const can = useTenantAuthStore((state) => state.can);

  const canCreate = can("categories:create");
  const canUpdate = can("categories:update");
  const canDelete = can("categories:delete");

  const categories = useCategoriesStore((state) => state.categories);
  const getCategories = useCategoriesStore((state) => state.getCategories);
  const createCategory = useCategoriesStore((state) => state.createCategory);
  const updateCategory = useCategoriesStore((state) => state.updateCategory);
  const moveCategory = useCategoriesStore((state) => state.moveCategory);
  const isMoving = useCategoriesStore((state) => state.isMoving);
  const deleteCategory = useCategoriesStore((state) => state.deleteCategory);
  const deleteAllCategories = useCategoriesStore((state) => state.deleteAllCategories);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<Partial<ICategoryResponse> | null>(null);

  // Modal para confirmación de eliminación individual
  const [categoryToDelete, setCategoryToDelete] = useState<ICategoryResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Modal para confirmación de eliminación masiva (todas)
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState<boolean>(false);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);

  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      await getCategories(token!);
      setIsLoading(false);
    };
    fetchCategories();
  }, [getCategories, token]);

  // Construir la lista con orden jerárquico (padres seguidos inmediatamente de sus hijas)
  const hierarchicalCategories = useMemo(() => {
    const tree = buildCategoryTree(categories);
    // Categorías huérfanas o no alcanzadas (resguardo de integridad)
    const visitedIds = new Set(tree.map((c) => String(c.id)));
    const unvisited = categories
      .filter((c) => !visitedIds.has(String(c.id)))
      .map((c) => ({
        ...c,
        level: 0,
        hasChildren: false,
      }));
    return [...tree, ...unvisited];
  }, [categories]);

  // Filtrado reactivo en tiempo real conservando el orden de árbol
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return hierarchicalCategories;

    return hierarchicalCategories.filter((c) => {
      const name = c.name?.toLowerCase() || "";
      const slug = c.slug?.toLowerCase() || "";
      const parentName = c.parent_name?.toLowerCase() || "";
      const fullPath = c.full_path?.toLowerCase() || "";

      return (
        name.includes(query) ||
        slug.includes(query) ||
        parentName.includes(query) ||
        fullPath.includes(query)
      );
    });
  }, [hierarchicalCategories, searchQuery]);

  const handleOpenCreateModal = () => {
    setSelectedCategory(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  // Abrir modal con la categoría padre ya preseleccionada
  const handleAddSubcategoryClick = (parentCategory: ICategoryResponse) => {
    setSelectedCategory({ parent_id: Number(parentCategory.id) });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (category: ICategoryResponse) => {
    setSelectedCategory(category);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (formData: { name: string; parent_id: number | null; color: string }) => {
    if (isEditing && selectedCategory?.id) {
      return await updateCategory(Number(selectedCategory.id), formData, token!);
    } else {
      return await createCategory(formData, token!);
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete?.id) return;
    try {
      setIsDeleting(true);
      const success = await deleteCategory(Number(categoryToDelete.id), token!);
      if (success) {
        setCategoryToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    try {
      setIsDeletingAll(true);
      const success = await deleteAllCategories();
      if (success) {
        setIsDeleteAllOpen(false);
      }
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="my-2 px-2 sm:px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-3 pb-12">
      <DynamicBreadcrumbs title="Categorías" />

      {/* Top Bar: Título, contador y botón Nueva Categoría */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-default-900">Categorías</h3>
          <Chip
            size="sm"
            color="primary"
            variant="flat"
            className="font-semibold text-xs h-6 px-2"
          >
            {categories.length}
          </Chip>
        </div>

        <div className="flex items-center gap-2">
          {canDelete && categories.length > 0 && (
            <Button
              color="danger"
              variant="flat"
              size="sm"
              radius="lg"
              startContent={<LuTrash2 size={15} />}
              isDisabled={isMoving || isLoading}
              onPress={() => setIsDeleteAllOpen(true)}
              className="font-semibold text-xs px-3 shadow-xs"
            >
              Eliminar todas
            </Button>
          )}

          {canCreate && (
            <Button
              color="primary"
              variant="solid"
              size="sm"
              radius="lg"
              startContent={<LuFolderPlus size={15} />}
              isDisabled={isMoving}
              onPress={handleOpenCreateModal}
              className="font-semibold text-xs px-3 shadow-sm"
            >
              Nueva categoría
            </Button>
          )}
        </div>
      </div>

      {/* Buscador de categorías */}
      <div className="w-full">
        <Input
          placeholder="Buscar por nombre o jerarquía..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
          isClearable
          size="sm"
          radius="lg"
          variant="flat"
          startContent={<LuSearch size={15} className="text-default-400" />}
          className="w-full sm:max-w-md"
        />
      </div>

      {/* Tabla de Categorías: Responsive con scroll horizontal y espaciado compacto */}
      <CategoryDnd categories={categories} disabled={!canUpdate || isMoving || isLoading} onMove={moveCategory}>
        {({ activeId, overId, isHeaderOver, headerDropRef, activeCategory, isDraggingSubcategory }) => {
          // Si el usuario está arrastrando una subcategoría o categoría, mostramos el árbol completo
          // para garantizar que todas las categorías destino estén visibles y accesibles para soltar.
          const displayCategories = activeId !== null ? hierarchicalCategories : filteredCategories;

          return (
            <div className="flex flex-col gap-2">
              {activeId !== null && (
                <div
                  className={`px-3 py-2.5 rounded-xl border text-xs flex items-center justify-between transition-all shadow-xs ${
                    isHeaderOver
                      ? "bg-primary/20 border-primary text-primary font-semibold ring-2 ring-primary"
                      : "bg-primary-50 dark:bg-primary-950/40 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LuGitBranch size={15} className="shrink-0" />
                    <span>
                      {isDraggingSubcategory ? (
                        <>
                          Arrastrando subcategoría <strong>"{activeCategory?.name}"</strong>: suelta sobre cualquier otra categoría para moverla allí, o <strong>arrástrala al encabezado de la tabla</strong> para convertirla en categoría principal.
                        </>
                      ) : (
                        <>
                          Arrastrando <strong>"{activeCategory?.name}"</strong>: suelta sobre cualquier categoría destino para meterla como subcategoría.
                        </>
                      )}
                    </span>
                  </div>
                  {isHeaderOver && isDraggingSubcategory && (
                    <span className="text-[11px] bg-primary text-white font-bold px-2.5 py-0.5 rounded-full animate-pulse shrink-0">
                      Soltar para convertir en principal
                    </span>
                  )}
                </div>
              )}

              <Card className={"border-none shadow-sm rounded-2xl bg-content1 overflow-hidden transition-all " + (isHeaderOver ? "ring-2 ring-primary" : "")}>
                <div ref={headerDropRef} className="w-full overflow-x-auto">
                  <Table
                    aria-label="Tabla de categorías"
                    removeWrapper
                    classNames={{
                      table: "min-w-[620px] w-full",
                      th: isHeaderOver
                        ? "py-2.5 px-2.5 text-[11px] font-bold uppercase tracking-wider text-primary bg-primary-100 dark:bg-primary-900/40 h-10 transition-colors"
                        : isDraggingSubcategory
                          ? "py-2 px-2.5 text-[11px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-50/70 dark:bg-primary-950/40 border-b border-dashed border-primary/40 h-9 transition-colors"
                          : "py-2 px-2.5 text-[11px] font-bold uppercase tracking-wider text-default-500 bg-default-100/40 h-8",
                      td: "py-1 px-2.5 text-xs",
                    }}
                  >
                    <TableHeader>
                      <TableColumn className="uppercase text-[11px] font-bold py-2 px-2.5">
                        {isHeaderOver ? (
                          <span className="text-primary font-bold flex items-center gap-1.5 animate-pulse">
                            ⭐ SOLTAR AQUÍ PARA CONVERTIR EN CATEGORÍA PRINCIPAL
                          </span>
                        ) : isDraggingSubcategory ? (
                          <span className="flex items-center gap-1.5 text-primary">
                            CATEGORÍA <span className="text-[10px] font-normal opacity-85">(Arrastra al encabezado para convertir en principal)</span>
                          </span>
                        ) : (
                          "CATEGORÍA"
                        )}
                      </TableColumn>
                      <TableColumn className="uppercase text-[11px] font-bold py-2 px-2.5">JERARQUÍA / TIPO</TableColumn>
                      <TableColumn className="uppercase text-[11px] font-bold text-center py-2 px-2.5">PRODUCTOS</TableColumn>
                      <TableColumn className="uppercase text-[11px] font-bold text-center py-2 px-2.5">SUBCATEGORÍAS</TableColumn>
                      <TableColumn align="end" className="uppercase text-[11px] font-bold text-right py-2 px-2.5">ACCIONES</TableColumn>
                    </TableHeader>
                    <TableBody
                      isLoading={isLoading}
                      loadingContent={
                        <div className="p-6 flex flex-col items-center gap-2">
                          <Skeleton className="h-5 w-40 rounded-lg" />
                          <Skeleton className="h-5 w-56 rounded-lg" />
                        </div>
                      }
                      emptyContent={
                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                          <div className="p-3 rounded-2xl bg-default-100 text-default-400">
                            <LuFolder size={28} />
                          </div>
                          <h3 className="text-sm font-semibold text-default-700">No hay categorías registradas</h3>
                          <p className="text-xs text-default-400 max-w-xs">
                            {searchQuery
                              ? `Sin coincidencias para "${searchQuery}".`
                              : "Comienza creando tu primera categoría principal o subcategoría."}
                          </p>
                        </div>
                      }
                    >
                      {displayCategories.map((cat) => {
                        const isSub = Boolean(cat.parent_id);
                        const acceptsDrop = activeId !== null && categoryMoveError(categories, activeId, Number(cat.id)) === null
                          && !sameId(categories.find((item) => sameId(item.id, activeId))?.parent_id, cat.id);
                        const isHoveredTarget = acceptsDrop && overId === String(cat.id);
                        const isBeingDragged = sameId(cat.id, activeId);
                        const levelIndent = cat.level > 0 ? cat.level * 18 : 0;

                        return (
                          <TableRow
                            key={cat.id}
                            className={"transition-colors " + (isHoveredTarget
                              ? "bg-primary/20 ring-2 ring-inset ring-primary"
                              : acceptsDrop
                                ? "bg-primary/5 hover:bg-primary/10"
                                : isBeingDragged
                                  ? "opacity-50 bg-default-100/50"
                                  : isSub ? "bg-default-50/20 hover:bg-default-50/60" : "bg-background hover:bg-default-50/60")}
                          >
                            {/* Categoría con indentación en árbol visual y dot de color */}
                            <TableCell className="py-1 px-2.5">
                              <div
                                className="flex items-center gap-1.5 py-0.5"
                                style={{ paddingLeft: `${levelIndent}px` }}
                              >
                                {canUpdate && <CategoryDragHandle category={cat} categories={categories} disabled={isMoving || isLoading} />}
                                {isHoveredTarget && (
                                  <span className="text-primary text-[10px] font-semibold bg-primary/15 px-1.5 py-0.5 rounded-md border border-primary/30">
                                    Meter como subcategoría
                                  </span>
                                )}
                                {/* Conector jerárquico si es subcategoría */}
                                {isSub && (
                                  <div className="flex items-center text-default-400 shrink-0">
                                    <LuCornerDownRight size={13} />
                                  </div>
                                )}

                                {/* Dot con color identificativo asignado */}
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs border border-white/40 dark:border-black/20"
                                  style={{ backgroundColor: cat.color || "#6366f1" }}
                                  title={`Color: ${cat.color || "#6366f1"}`}
                                />

                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`text-xs truncate max-w-[170px] sm:max-w-[260px] ${isSub
                                      ? "font-medium text-default-800"
                                      : "font-semibold text-default-900"
                                      }`}
                                  >
                                    {cat.name}
                                  </span>
                                </div>
                              </div>
                            </TableCell>

                            {/* Jerarquía / Tipo */}
                            <TableCell className="py-1 px-2.5">
                              {isSub ? (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color="secondary"
                                  startContent={<LuGitBranch size={11} className="ml-0.5" />}
                                  className="text-[10px] font-medium h-5 px-1.5"
                                >
                                  <strong className="ml-1 font-semibold">{cat.parent_name || "Superior"}</strong>
                                </Chip>
                              ) : (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color="default"
                                  className="text-[10px] font-semibold h-5 px-1.5"
                                >
                                  Principal
                                </Chip>
                              )}
                            </TableCell>

                            {/* Productos */}
                            <TableCell className="text-center py-1 px-2.5">
                              <Chip
                                size="sm"
                                variant="dot"
                                color={(cat.product_count ?? 0) > 0 ? "success" : "default"}
                                className="text-[10px] font-medium h-5 px-1.5"
                              >
                                {cat.product_count ?? 0} {cat.product_count === 1 ? "prod." : "prods."}
                              </Chip>
                            </TableCell>

                            {/* Subcategorías: Contador + Botón "+ Subcategoría" */}
                            <TableCell className="text-center py-1 px-2.5">
                              <div className="flex items-center justify-center gap-1.5">
                                {canCreate && (
                                  <Tooltip content={`Agregar subcategoría dentro de "${cat.name}"`}>
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      color="primary"
                                      radius="md"
                                      startContent={<LuPlus size={11} />}
                                      isDisabled={isMoving}
                                      onPress={() => handleAddSubcategoryClick(cat)}
                                      className="text-[10px] font-semibold h-6 px-1.5 shadow-xs"
                                    >
                                      Subcategoría
                                    </Button>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>

                            {/* Acciones */}
                            <TableCell className="py-1 px-2.5">
                              <div className="flex items-center justify-end gap-0.5 min-w-[95px]">
                                <Tooltip content="Ver detalles">
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="h-7 w-7 min-w-7 text-default-500 hover:text-primary rounded-md"
                                    onPress={() => navigate(`/categories/${cat.id}`)}
                                    aria-label="Ver categoría"
                                  >
                                    <LuEye size={15} />
                                  </Button>
                                </Tooltip>

                                {canUpdate && (
                                  <Tooltip content="Editar categoría">
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      className="h-7 w-7 min-w-7 text-default-500 hover:text-warning rounded-md"
                                      isDisabled={isMoving}
                                      onPress={() => handleOpenEditModal(cat)}
                                      aria-label="Editar categoría"
                                    >
                                      <LuPencil size={14} />
                                    </Button>
                                  </Tooltip>
                                )}

                                {canDelete && (
                                  <Tooltip content="Eliminar categoría" color="danger">
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      color="danger"
                                      className="h-7 w-7 min-w-7 text-default-400 hover:text-danger rounded-md"
                                      isDisabled={isMoving}
                                      onPress={() => setCategoryToDelete(cat)}
                                      aria-label="Eliminar categoría"
                                    >
                                      <LuTrash2 size={14} />
                                    </Button>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          );
        }}
      </CategoryDnd>

      {/* Category Create & Edit Modal */}
      {isModalOpen && (
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={selectedCategory}
          categories={categories}
          isEditing={isEditing}
        />
      )}

      {/* Delete Confirmation Modal (Individual) */}
      <Modal
        isOpen={Boolean(categoryToDelete)}
        onClose={() => setCategoryToDelete(null)}
        placement="center"
        size="sm"
        classNames={{
          base: "border border-default-200 dark:border-default-100/20 rounded-2xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2.5 text-danger border-b border-default-100 py-3">
                <LuAlertTriangle size={20} />
                <h3 className="text-base font-bold text-default-900">Eliminar Categoría</h3>
              </ModalHeader>
              <ModalBody className="py-4">
                <p className="text-sm text-default-600">
                  ¿Deseas eliminar la categoría{" "}
                  <strong className="text-default-900">"{categoryToDelete?.name}"</strong>?
                </p>
                {categoryToDelete?.product_count && categoryToDelete.product_count > 0 ? (
                  <p className="text-xs text-danger font-semibold mt-2">
                    Advertencia: Esta categoría tiene {categoryToDelete.product_count} productos asociados.
                  </p>
                ) : null}
                {categoryToDelete?.children && categoryToDelete.children.length > 0 ? (
                  <p className="text-xs text-danger font-semibold mt-1">
                    Advertencia: Tiene {categoryToDelete.children.length} subcategorías asociadas. Debes reasignarlas o eliminarlas antes.
                  </p>
                ) : null}
              </ModalBody>
              <ModalFooter className="border-t border-default-100 py-2.5">
                <Button size="sm" variant="light" onPress={onClose} isDisabled={isDeleting} radius="lg">
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  onPress={handleConfirmDelete}
                  isLoading={isDeleting}
                  radius="lg"
                  className="font-semibold shadow-sm"
                >
                  Eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete All Categories Confirmation Modal */}
      <Modal
        isOpen={isDeleteAllOpen}
        onClose={() => !isDeletingAll && setIsDeleteAllOpen(false)}
        placement="center"
        size="md"
        classNames={{
          base: "border border-danger-200 dark:border-danger-900/30 rounded-2xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2.5 text-danger border-b border-default-100 py-3">
                <LuAlertTriangle size={20} />
                <h3 className="text-base font-bold text-default-900">Eliminar Todas las Categorías</h3>
              </ModalHeader>
              <ModalBody className="py-4 flex flex-col gap-2">
                <p className="text-sm text-default-700">
                  ¿Estás seguro de que deseas eliminar las{" "}
                  <strong className="text-danger font-bold">{categories.length} categorías</strong> registradas?
                </p>
                <p className="text-xs text-default-500">
                  Esta acción desvinculará las categorías de todos los productos existentes y eliminará de forma permanente tanto las categorías principales como todas las subcategorías. Esta acción no se puede deshacer.
                </p>
              </ModalBody>
              <ModalFooter className="border-t border-default-100 py-2.5">
                <Button size="sm" variant="light" onPress={onClose} isDisabled={isDeletingAll} radius="lg">
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  onPress={handleConfirmDeleteAll}
                  isLoading={isDeletingAll}
                  radius="lg"
                  className="font-semibold shadow-sm"
                >
                  Sí, eliminar todas
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
