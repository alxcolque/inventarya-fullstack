import { useEffect, useMemo, useState } from "react";
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
  Tabs,
  Tab,
} from "@nextui-org/react";
import {
  LuMapPin,
  LuSearch,
  LuPencil,
  LuTrash2,
  LuGitBranch,
  LuCornerDownRight,
  LuAlertTriangle,
  LuPlus,
} from "react-icons/lu";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useLocationsStore } from "../../store/locations/locations.store";
import { LocationModal } from "./components/LocationModal";
import { ILocationResponse } from "@/interface";

interface HierarchicalLocation extends ILocationResponse {
  level: number;
  hasChildren: boolean;
}

// Función para construir la jerarquía recursiva (árbol ordenado en profundidad)
const buildLocationTree = (
  items: ILocationResponse[],
  parentId: number | string | null = null,
  level = 0
): HierarchicalLocation[] => {
  const directChildren = items.filter((item) => {
    if (parentId === null || parentId === "") {
      return !item.parent_id;
    }
    return String(item.parent_id) === String(parentId);
  });

  // Ordenar alfabéticamente dentro del mismo nivel
  directChildren.sort((a, b) => a.name.localeCompare(b.name));

  let result: HierarchicalLocation[] = [];

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
      result = result.concat(buildLocationTree(items, child.id, level + 1));
    }
  });

  return result;
};

export const IndexLocations = () => {
  const can = useTenantAuthStore((state) => state.can);

  const canCreate = can("locations:create");
  const canUpdate = can("locations:update");
  const canDelete = can("locations:delete");

  const locations = useLocationsStore((state) => state.locations);
  const isLoading = useLocationsStore((state) => state.isLoading);
  const getLocations = useLocationsStore((state) => state.getLocations);
  const createLocation = useLocationsStore((state) => state.createLocation);
  const updateLocation = useLocationsStore((state) => state.updateLocation);
  const deleteLocation = useLocationsStore((state) => state.deleteLocation);

  const [searchQuery, setSearchQuery] = useState<string>("all");
  const [selectedTab, setSelectedTab] = useState<string>("all"); // 'all' | 'roots' | 'subs'
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<Record<string, any> | null>(null);

  // Modal para ver detalle rápido
  const [locationToView, setLocationToView] = useState<ILocationResponse | null>(null);

  // Modal para confirmación de eliminación
  const [locationToDelete, setLocationToDelete] = useState<ILocationResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  useEffect(() => {
    getLocations();
  }, [getLocations]);

  // Construir la lista con orden jerárquico (padres seguidos inmediatamente de sus hijas)
  const hierarchicalLocations = useMemo(() => {
    const tree = buildLocationTree(locations);
    // Ubicaciones huérfanas o no alcanzadas (resguardo de integridad)
    const visitedIds = new Set(tree.map((l) => String(l.id)));
    const unvisited = locations
      .filter((l) => !visitedIds.has(String(l.id)))
      .map((l) => ({
        ...l,
        level: 0,
        hasChildren: false,
      }));
    return [...tree, ...unvisited];
  }, [locations]);

  // Contadores de raíz y sub-ubicaciones
  const rootCount = useMemo(
    () => locations.filter((l) => !l.parent_id).length,
    [locations]
  );
  const subCount = useMemo(
    () => locations.filter((l) => Boolean(l.parent_id)).length,
    [locations]
  );

  // Filtrado reactivo en tiempo real conservando el orden de árbol
  const filteredLocations = useMemo(() => {
    let list = hierarchicalLocations;

    // Filtro por pestaña
    if (selectedTab === "roots") {
      list = list.filter((l) => !l.parent_id);
    } else if (selectedTab === "subs") {
      list = list.filter((l) => Boolean(l.parent_id));
    }

    // Filtro por búsqueda
    const query = searchQuery === "all" ? "" : searchQuery.trim().toLowerCase();
    if (!query) return list;

    return list.filter((l) => {
      const name = l.name?.toLowerCase() || "";
      const slug = l.slug?.toLowerCase() || "";
      const parentName = l.parent_name?.toLowerCase() || "";
      const fullPath = l.full_path?.toLowerCase() || "";

      return (
        name.includes(query) ||
        slug.includes(query) ||
        parentName.includes(query) ||
        fullPath.includes(query)
      );
    });
  }, [hierarchicalLocations, selectedTab, searchQuery]);

  const handleOpenCreateModal = () => {
    setSelectedLocation(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  // Abrir modal con la ubicación padre ya preseleccionada
  const handleAddSublocationClick = (parentLocation: ILocationResponse) => {
    setSelectedLocation({
      parent_id: parentLocation.id,
      parent_name: parentLocation.name,
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (loc: ILocationResponse) => {
    setSelectedLocation(loc);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (data: { name: string; parent_id: number | null }) => {
    if (isEditing && selectedLocation?.id) {
      return await updateLocation(Number(selectedLocation.id), data);
    } else {
      return await createLocation(data);
    }
  };

  const handleConfirmDelete = async () => {
    if (!locationToDelete?.id) return;
    try {
      setIsDeleting(true);
      const success = await deleteLocation(Number(locationToDelete.id));
      if (success) {
        setLocationToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="my-2 px-2 sm:px-4 lg:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-3 pb-12">
      <DynamicBreadcrumbs title="Ubicaciones" />

      {/* Top Bar: Título, contador y botón Nueva Ubicación */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-default-900">Ubicaciones</h3>
          <Chip
            size="sm"
            color="primary"
            variant="flat"
            className="font-semibold text-xs h-6 px-2"
          >
            {locations.length}
          </Chip>
        </div>

        {canCreate && (
          <Button
            color="primary"
            variant="solid"
            size="sm"
            radius="lg"
            startContent={<LuPlus size={15} />}
            onPress={handleOpenCreateModal}
            className="font-semibold text-xs px-3 shadow-sm"
          >
            Nueva ubicación
          </Button>
        )}
      </div>

      {/* Selector de pestañas y buscador en fila compacta */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={(k) => setSelectedTab(k as string)}
          size="sm"
          color="primary"
          variant="solid"
          radius="lg"
          aria-label="Filtro de ubicaciones"
        >
          <Tab
            key="all"
            title={
              <div className="flex items-center gap-1.5 text-xs">
                <span>Todas</span>
                <span className="text-[10px] opacity-70">({locations.length})</span>
              </div>
            }
          />
          <Tab
            key="roots"
            title={
              <div className="flex items-center gap-1.5 text-xs">
                <span>Principales</span>
                <span className="text-[10px] opacity-70">({rootCount})</span>
              </div>
            }
          />
          <Tab
            key="subs"
            title={
              <div className="flex items-center gap-1.5 text-xs">
                <span>Sub-ubicaciones</span>
                <span className="text-[10px] opacity-70">({subCount})</span>
              </div>
            }
          />
        </Tabs>

        <Input
          placeholder="Buscar por nombre o jerarquía..."
          value={searchQuery === "all" ? "" : searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
          isClearable
          size="sm"
          radius="lg"
          variant="flat"
          startContent={<LuSearch size={15} className="text-default-400" />}
          className="w-full sm:max-w-xs"
        />
      </div>

      {/* Tabla de Ubicaciones: Responsive con scroll horizontal y espaciado compacto (Sin Colores) */}
      <Card className="border-none shadow-sm rounded-2xl bg-content1 overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table
            aria-label="Tabla de ubicaciones del inventario"
            removeWrapper
            classNames={{
              table: "min-w-[620px] w-full",
              th: "py-2 px-2.5 text-[11px] font-bold uppercase tracking-wider text-default-500 bg-default-100/40 h-8",
              td: "py-1 px-2.5 text-xs",
            }}
          >
            <TableHeader>
              <TableColumn className="uppercase text-[11px] font-bold py-2 px-2.5">UBICACIÓN</TableColumn>
              <TableColumn className="uppercase text-[11px] font-bold py-2 px-2.5">JERARQUÍA / TIPO</TableColumn>
              <TableColumn className="uppercase text-[11px] font-bold text-center py-2 px-2.5">SUB-UBICACIONES</TableColumn>
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
                    <LuMapPin size={28} />
                  </div>
                  <h3 className="text-sm font-semibold text-default-700">No hay ubicaciones registradas</h3>
                  <p className="text-xs text-default-400 max-w-xs">
                    {searchQuery && searchQuery !== "all"
                      ? `Sin coincidencias para "${searchQuery}".`
                      : "Comienza creando tu primera ubicación principal (ej: Almacén Central)."}
                  </p>
                </div>
              }
            >
              {filteredLocations.map((loc) => {
                const isSub = Boolean(loc.parent_id);
                const childrenCount = loc.children?.length || 0;
                const levelIndent = loc.level > 0 ? loc.level * 18 : 0;

                return (
                  <TableRow
                    key={loc.id}
                    className={`hover:bg-default-50/60 transition-colors ${isSub ? "bg-default-50/20" : "bg-background"
                      }`}
                  >
                    {/* Ubicación con indentación en árbol visual */}
                    <TableCell className="py-1 px-2.5">
                      <div
                        className="flex items-center gap-1.5 py-0.5"
                        style={{ paddingLeft: `${levelIndent}px` }}
                      >
                        {/* Conector jerárquico si es sub-ubicación */}
                        {isSub && (
                          <div className="flex items-center text-default-400 shrink-0">
                            <LuCornerDownRight size={13} />
                          </div>
                        )}

                        {/* Icono de ubicación limpio sin colores */}
                        <div className="p-1 rounded-md bg-default-100 text-default-600 dark:text-default-400 shrink-0">
                          <LuMapPin size={12} />
                        </div>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`text-xs truncate max-w-[180px] sm:max-w-[280px] ${isSub
                              ? "font-medium text-default-800"
                              : "font-semibold text-default-900"
                              }`}
                          >
                            {loc.name}
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
                          <strong className="ml-1 font-semibold">{loc.parent_name || "Superior"}</strong>
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

                    {/* Sub-ubicaciones: Contador + Botón "+ Sub-ubicación" */}
                    <TableCell className="text-center py-1 px-2.5">
                      <div className="flex items-center justify-center gap-1.5">

                        {canCreate && (
                          <Tooltip content={`Agregar sub-ubicación dentro de "${loc.name}"`}>
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              radius="md"
                              startContent={<LuPlus size={11} />}
                              onPress={() => handleAddSublocationClick(loc)}
                              className="text-[10px] font-semibold h-6 px-1.5 shadow-xs"
                            >
                              Sub-ubicación
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="py-1 px-2.5">
                      <div className="flex items-center justify-end gap-0.5 min-w-[95px]">

                        {canUpdate && (
                          <Tooltip content="Editar ubicación">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              className="h-7 w-7 min-w-7 text-default-500 hover:text-warning rounded-md"
                              onPress={() => handleOpenEditModal(loc)}
                              aria-label="Editar ubicación"
                            >
                              <LuPencil size={14} />
                            </Button>
                          </Tooltip>
                        )}

                        {canDelete && (
                          <Tooltip content="Eliminar ubicación" color="danger">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              className="h-7 w-7 min-w-7 text-default-400 hover:text-danger rounded-md"
                              onPress={() => setLocationToDelete(loc)}
                              aria-label="Eliminar ubicación"
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

      {/* Location Create & Edit Modal */}
      {isModalOpen && (
        <LocationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleFormSubmit}
          initialData={selectedLocation}
          locations={locations}
          isEditing={isEditing}
        />
      )}

      {/* View Detail Quick Modal */}
      {locationToView && (
        <Modal
          isOpen={Boolean(locationToView)}
          onClose={() => setLocationToView(null)}
          size="sm"
          backdrop="blur"
          placement="center"
          classNames={{
            base: "border-none shadow-2xl rounded-3xl bg-background",
            header: "border-b border-divider/40 px-5 py-3.5",
            body: "px-5 py-4",
            footer: "border-t border-divider/40 px-5 py-3",
          }}
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/40 text-primary">
                    <LuMapPin size={18} />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-base font-bold text-default-900 leading-tight">
                      Detalle de Ubicación
                    </h3>
                    <span className="text-[11px] text-default-400 font-mono">
                      ID: #{locationToView.id}
                    </span>
                  </div>
                </ModalHeader>
                <ModalBody className="flex flex-col gap-3 text-xs">
                  <div className="flex flex-col gap-1 p-3 rounded-2xl bg-default-100/50">
                    <span className="text-[11px] font-semibold text-default-400 uppercase">
                      Nombre
                    </span>
                    <span className="text-sm font-bold text-default-900">
                      {locationToView.name}
                    </span>
                    <span className="text-[11px] text-default-400 font-mono">
                      slug: {locationToView.slug}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 p-3 rounded-2xl bg-default-100/50">
                    <span className="text-[11px] font-semibold text-default-400 uppercase">
                      Jerarquía
                    </span>
                    <span className="text-xs text-default-700">
                      {locationToView.parent_name ? (
                        <>
                          Sub-ubicación dentro de:{" "}
                          <strong className="text-primary font-semibold">
                            {locationToView.parent_name}
                          </strong>
                        </>
                      ) : (
                        "Ubicación Principal (Nivel Raíz)"
                      )}
                    </span>
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setLocationToView(null)}
                    className="text-xs font-medium"
                  >
                    Cerrar
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {locationToDelete && (
        <Modal
          isOpen={Boolean(locationToDelete)}
          onClose={() => setLocationToDelete(null)}
          size="sm"
          backdrop="blur"
          placement="center"
          classNames={{
            base: "border-none shadow-2xl rounded-3xl bg-background",
            header: "border-b border-divider/40 px-5 py-3.5",
            body: "px-5 py-4",
            footer: "border-t border-divider/40 px-5 py-3",
          }}
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex items-center gap-2 text-danger">
                  <LuAlertTriangle size={20} />
                  <span className="text-base font-bold">¿Eliminar Ubicación?</span>
                </ModalHeader>
                <ModalBody className="flex flex-col gap-2">
                  <p className="text-xs text-default-600">
                    ¿Estás seguro de que deseas eliminar la ubicación{" "}
                    <strong className="text-default-900 font-bold">
                      "{locationToDelete.name}"
                    </strong>
                    ?
                  </p>
                  <p className="text-[11px] text-default-400">
                    Esta acción no se puede deshacer. No se podrá eliminar si contiene sub-ubicaciones o ítems de inventario asignados.
                  </p>
                </ModalBody>
                <ModalFooter className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setLocationToDelete(null)}
                    isDisabled={isDeleting}
                    className="text-xs font-medium"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="solid"
                    isLoading={isDeleting}
                    startContent={!isDeleting && <LuTrash2 size={14} />}
                    onPress={handleConfirmDelete}
                    className="text-xs font-semibold px-3 shadow-sm"
                  >
                    Sí, Eliminar
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}
    </div>
  );
};
