import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
} from "@nextui-org/react";
import {
  LuMapPin,
  LuGitBranch,
  LuSave,
} from "react-icons/lu";
import { ILocationResponse } from "@/interface";

interface LocationFormData {
  name: string;
  parent_id: string;
}

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; parent_id: number | null }) => Promise<boolean>;
  initialData?: Record<string, any> | null;
  locations: ILocationResponse[];
  isEditing?: boolean;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  locations,
  isEditing = false,
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LocationFormData>({
    defaultValues: {
      name: "",
      parent_id: "",
    },
  });

  const watchName = watch("name");
  const watchParentId = watch("parent_id");

  // Filtrar ubicaciones que no pueden ser seleccionadas como padre
  // (no puede ser la misma ubicación ni ninguno de sus descendientes)
  const availableParents = useMemo(() => {
    if (!isEditing || !initialData) {
      return locations;
    }

    const currentId = String(initialData.id);

    const getDescendantIds = (parentId: string | number): string[] => {
      const children = locations.filter(
        (l) => String(l.parent_id) === String(parentId)
      );
      let ids: string[] = [];
      children.forEach((c) => {
        ids.push(String(c.id));
        ids = ids.concat(getDescendantIds(c.id));
      });
      return ids;
    };

    const invalidIds = new Set<string>([
      currentId,
      ...getDescendantIds(currentId),
    ]);

    return locations.filter((l) => !invalidIds.has(String(l.id)));
  }, [locations, isEditing, initialData]);

  // Reset del formulario al abrir
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          name: initialData.name || "",
          parent_id: initialData.parent_id ? String(initialData.parent_id) : "",
        });
      } else {
        reset({
          name: "",
          parent_id: "",
        });
      }

      setTimeout(() => {
        setFocus("name");
      }, 100);
    }
  }, [isOpen, initialData, reset, setFocus]);

  const onFormSubmit = async (data: LocationFormData) => {
    const payload = {
      name: data.name.trim(),
      parent_id: data.parent_id ? Number(data.parent_id) : null,
    };

    const success = await onSubmit(payload);
    if (success) {
      onClose();
    }
  };

  const selectedParentLocation = useMemo(() => {
    if (!watchParentId) return null;
    return locations.find((l) => String(l.id) === String(watchParentId));
  }, [watchParentId, locations]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      backdrop="blur"
      size="md"
      classNames={{
        base: "border-none shadow-2xl rounded-3xl bg-background",
        header: "border-b border-divider/40 px-5 py-3.5",
        body: "px-5 py-4",
        footer: "border-t border-divider/40 px-5 py-3",
      }}
    >
      <ModalContent>
        {() => (
          <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
            <ModalHeader className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/50 text-primary">
                <LuMapPin size={18} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-default-900 leading-tight">
                  {isEditing ? "Editar Ubicación" : "Nueva Ubicación"}
                </h3>
                <p className="text-xs text-default-400 font-normal">
                  {isEditing
                    ? "Modifica el nombre o nivel jerárquico del espacio"
                    : "Crea un almacén, pasillo, estante o espacio físico"}
                </p>
              </div>
            </ModalHeader>

            <ModalBody className="flex flex-col gap-3.5">
              {/* Nombre de la Ubicación */}
              <Input
                {...register("name", {
                  required: "El nombre de la ubicación es obligatorio",
                  maxLength: {
                    value: 100,
                    message: "Máximo 100 caracteres",
                  },
                })}
                label="Nombre de la Ubicación"
                placeholder="ej: Almacén Central, Pasillo 3, Estante B..."
                size="sm"
                radius="lg"
                variant="flat"
                isRequired
                isInvalid={Boolean(errors.name)}
                errorMessage={errors.name?.message}
                startContent={<LuMapPin size={15} className="text-default-400" />}
              />

              {/* Ubicación Superior / Contenedora */}
              <div className="flex flex-col gap-1.5">
                <Select
                  label="Ubicación Superior (Contenedora)"
                  placeholder="Selecciona una ubicación padre (opcional)"
                  size="sm"
                  radius="lg"
                  variant="flat"
                  selectedKeys={watchParentId ? [watchParentId] : []}
                  onChange={(e) => setValue("parent_id", e.target.value)}
                  startContent={<LuGitBranch size={15} className="text-default-400" />}
                  description="Déjalo vacío para crear una ubicación principal / raíz."
                >
                  {availableParents.map((loc) => (
                    <SelectItem
                      key={String(loc.id)}
                      textValue={`${loc.name}${loc.parent_name ? ` (${loc.parent_name})` : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2 py-0.5">
                        <span className="text-xs font-medium text-default-800">
                          {loc.name}
                        </span>
                        {loc.parent_name ? (
                          <span className="text-[10px] text-default-400 font-mono">
                            dentro de: {loc.parent_name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-primary font-medium">
                            Principal
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </Select>
              </div>

              {/* Tarjeta de previsualización compacta */}
              <div className="p-3 rounded-2xl bg-default-50/80 dark:bg-default-100/10 border border-default-200/50 flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-default-400 uppercase tracking-wider">
                  Jerarquía resultante
                </span>
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-950/40 text-primary">
                    <LuMapPin size={14} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-default-900 truncate">
                      {watchName || "Nombre de ubicación"}
                    </span>
                    <span className="text-[11px] text-default-500">
                      {selectedParentLocation ? (
                        <>
                          Sub-ubicación dentro de:{" "}
                          <strong className="text-primary font-semibold">
                            {selectedParentLocation.name}
                          </strong>
                        </>
                      ) : (
                        "Ubicación Principal (Nivel Raíz)"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="flat"
                size="sm"
                radius="lg"
                onPress={onClose}
                isDisabled={isSubmitting}
                className="text-xs font-medium"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                color="primary"
                variant="solid"
                size="sm"
                radius="lg"
                isLoading={isSubmitting}
                startContent={!isSubmitting && <LuSave size={15} />}
                className="text-xs font-semibold px-4 shadow-sm"
              >
                {isEditing ? "Actualizar Ubicación" : "Guardar Ubicación"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
