import React, { useEffect, useMemo, useState } from "react";
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
  Tooltip,
} from "@nextui-org/react";
import {
  LuFolder,
  LuFolderPlus,
  LuPalette,
  LuCheck,
  LuGitBranch,
  LuSave,
  LuDice5,
} from "react-icons/lu";
import { ICategoryResponse } from "@/interface";
import { isDescendant, sameId } from "../../../utils/categoryHierarchy";

// Paleta de colores armónicos modernos (tonos medios más vivos y oscuros)
export const LIGHT_PRESET_COLORS = [
  { hex: "#38BDF8", name: "Azul Cielo" },
  { hex: "#34D399", name: "Esmeralda" },
  { hex: "#FBBF24", name: "Ámbar Dorado" },
  { hex: "#FB923C", name: "Naranja" },
  { hex: "#FB7185", name: "Coral" },
  { hex: "#C084FC", name: "Púrpura" },
  { hex: "#A78BFA", name: "Violeta" },
  { hex: "#818CF8", name: "Índigo" },
  { hex: "#2DD4BF", name: "Turquesa" },
  { hex: "#F472B6", name: "Rosa" },
  { hex: "#A3E635", name: "Lima" },
  { hex: "#22D3EE", name: "Cian" },
  { hex: "#E879F9", name: "Fucsia" },
  { hex: "#F87171", name: "Rojo Suave" },
  { hex: "#4ADE80", name: "Verde Menta" },
  { hex: "#60A5FA", name: "Azul Real" },
];

export function getRandomLightColor(): string {
  const index = Math.floor(Math.random() * LIGHT_PRESET_COLORS.length);
  return LIGHT_PRESET_COLORS[index].hex;
}

export const PRESET_COLORS = LIGHT_PRESET_COLORS;

interface CategoryFormData {
  name: string;
  parent_id: string;
  color: string;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; parent_id: number | null; color: string }) => Promise<boolean>;
  initialData?: Partial<ICategoryResponse> | null;
  categories: ICategoryResponse[];
  isEditing?: boolean;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  categories,
  isEditing = false,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>(LIGHT_PRESET_COLORS[0].hex);
  const [hasUserSelectedColor, setHasUserSelectedColor] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    defaultValues: {
      name: "",
      parent_id: "",
      color: "",
    },
  });

  const watchName = watch("name");
  const watchParentId = watch("parent_id");

  const availableParents = useMemo(() => {
    const currentId = initialData?.id;
    return categories.filter((item) => {
      if (currentId && sameId(item.id, currentId)) return false;
      if (currentId && isDescendant(categories, currentId, item.id)) return false;
      return true;
    });
  }, [categories, initialData]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && initialData) {
        const color = initialData.color || getRandomLightColor();
        setSelectedColor(color);
        setHasUserSelectedColor(true);
        reset({
          name: initialData.name || "",
          parent_id: initialData.parent_id ? String(initialData.parent_id) : "",
          color: color,
        });
      } else {
        const randomLight = getRandomLightColor();
        setSelectedColor(randomLight);
        setHasUserSelectedColor(false);
        reset({
          name: "",
          parent_id: initialData?.parent_id ? String(initialData.parent_id) : "",
          color: "",
        });
      }
      setTimeout(() => {
        setFocus("name");
      }, 100);
    }
  }, [isOpen, isEditing, initialData, reset, setFocus]);

  const handleSelectColor = (hex: string) => {
    setSelectedColor(hex);
    setHasUserSelectedColor(true);
    setValue("color", hex);
  };

  const handleRandomizeColor = () => {
    const randomLight = getRandomLightColor();
    setSelectedColor(randomLight);
    setHasUserSelectedColor(false);
    setValue("color", "");
  };

  const onFormSubmit = async (data: CategoryFormData) => {
    // Si el usuario no eligió un color, se asigna el color claro aleatorio automáticamente
    const finalColor = hasUserSelectedColor && selectedColor
      ? selectedColor
      : (selectedColor || getRandomLightColor());

    const payload = {
      name: data.name.trim(),
      parent_id: data.parent_id && data.parent_id !== "" ? Number(data.parent_id) : null,
      color: finalColor,
    };

    const success = await onSubmit(payload);
    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      placement="center"
      backdrop="blur"
      scrollBehavior="inside"
      classNames={{
        base: "border border-default-200/70 dark:border-default-100/20 bg-background/95 backdrop-blur-md rounded-3xl shadow-2xl",
        header: "border-b border-default-100 px-6 py-4",
        footer: "border-t border-default-100 px-6 py-4",
        body: "p-6",
      }}
    >
      <ModalContent>
        {() => (
          <form onSubmit={handleSubmit(onFormSubmit)} noValidate>
            <ModalHeader className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="p-2.5 rounded-2xl shadow-sm flex items-center justify-center transition-colors text-white"
                  style={{ backgroundColor: selectedColor }}
                >
                  {isEditing ? <LuFolder size={22} /> : <LuFolderPlus size={22} />}
                </div>
                <div className="flex flex-col">
                  <h2 className="text-lg font-bold text-default-900 leading-tight">
                    {isEditing ? "Editar Categoría" : "Nueva Categoría"}
                  </h2>
                  <p className="text-xs text-default-400 font-normal">
                    {isEditing
                      ? "Modifica el nombre, jerarquía y color de la categoría"
                      : "Define nombre, subcategoría y color identificador"}
                  </p>
                </div>
              </div>

              {/* Vista previa en vivo del Chip */}
              <Chip
                size="sm"
                variant="solid"
                className="font-bold shadow-xs text-xs text-white"
                style={{ backgroundColor: selectedColor }}
              >
                {watchName ? watchName : "Vista previa"}
              </Chip>
            </ModalHeader>

            <ModalBody className="flex flex-col gap-5">
              {/* Nombre de la Categoría */}
              <Input
                isRequired
                autoFocus
                label="Nombre de la Categoría"
                placeholder="Ej: Laptops, Bebidas, Ropa de Invierno"
                labelPlacement="outside"
                startContent={<LuFolder size={18} className="text-default-400" />}
                maxLength={100}
                {...register("name", {
                  required: "El nombre de la categoría es obligatorio",
                  maxLength: {
                    value: 100,
                    message: "Máximo 100 caracteres",
                  },
                })}
                isInvalid={!!errors.name}
                errorMessage={errors.name?.message}
                variant="bordered"
                radius="lg"
                classNames={{
                  inputWrapper: "bg-background",
                }}
              />

              {/* Categoría Superior (Padre) */}
              <div className="flex flex-col gap-1.5">
                <Select
                  label="Categoría Superior (Jerarquía)"
                  labelPlacement="outside"
                  placeholder="Ninguna (Categoría Principal / Raíz)"
                  selectedKeys={watchParentId ? [watchParentId] : []}
                  onChange={(e) => setValue("parent_id", e.target.value)}
                  variant="bordered"
                  radius="lg"
                  startContent={<LuGitBranch size={18} className="text-default-400" />}
                  description={
                    watchParentId
                      ? "Se creará como una subcategoría dependiente de la seleccionada."
                      : "Si no seleccionas ninguna, será una categoría principal de primer nivel."
                  }
                  classNames={{
                    trigger: "bg-background",
                  }}
                >
                  {[
                    <SelectItem key="" textValue="Ninguna (Categoría Principal / Raíz)">
                      <div className="flex items-center gap-2 py-0.5">
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <span className="font-semibold text-xs text-default-900">
                          Ninguna (Categoría Principal / Raíz)
                        </span>
                      </div>
                    </SelectItem>,
                    ...availableParents.map((cat) => (
                      <SelectItem
                        key={String(cat.id)}
                        textValue={cat.full_path || cat.name}
                      >
                        <div className="flex items-center gap-2 py-0.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || "#6366f1" }}
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-default-900">
                              {cat.name}
                            </span>
                            {cat.parent_name && (
                              <span className="text-[10px] text-default-400">
                                Ruta: {cat.full_path || cat.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    )),
                  ]}
                </Select>
              </div>

              {/* Selector de Colores */}
              <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-default-50/70 dark:bg-default-100/20 border border-default-200/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <LuPalette size={16} className="text-default-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-default-600">
                      Color Identificativo
                    </span>
                    {!hasUserSelectedColor ? (
                      <Chip
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="text-[10px] h-5 px-1.5 font-semibold"
                      >
                        Aleatorio claro
                      </Chip>
                    ) : (
                      <Chip
                        size="sm"
                        variant="flat"
                        color="success"
                        className="text-[10px] h-5 px-1.5 font-semibold"
                      >
                        Personalizado
                      </Chip>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="flat"
                      radius="md"
                      startContent={<LuDice5 size={14} />}
                      onPress={handleRandomizeColor}
                      className="text-xs h-7 px-2 font-semibold bg-default-100 hover:bg-default-200"
                    >
                      Color claro aleatorio
                    </Button>
                    <span className="text-xs font-mono font-bold text-default-500">
                      {selectedColor.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-default-400">
                  Si no eliges un color, se asignará un color claro aleatorio automáticamente al registrar.
                </p>

                {/* Grilla de Colores Claros (Pastel) */}
                <div className="grid grid-cols-8 sm:grid-cols-8 gap-2 pt-1">
                  {LIGHT_PRESET_COLORS.map((preset) => {
                    const isSelected =
                      selectedColor.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <Tooltip key={preset.hex} content={preset.name} closeDelay={100}>
                        <button
                          type="button"
                          onClick={() => handleSelectColor(preset.hex)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer relative border border-black/10 dark:border-white/10 ${
                            isSelected
                              ? "ring-2 ring-offset-2 ring-primary scale-110 shadow-md"
                              : "hover:scale-105 opacity-85 hover:opacity-100"
                          }`}
                          style={{ backgroundColor: preset.hex }}
                          aria-label={`Seleccionar color ${preset.name}`}
                        >
                          {isSelected && (
                            <LuCheck size={14} className="text-white drop-shadow-sm stroke-[3]" />
                          )}
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>

                {/* Input personalizado de color */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-default-100/80">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => handleSelectColor(e.target.value)}
                    className="w-7 h-7 rounded-lg border border-default-300 cursor-pointer bg-transparent p-0"
                    title="Elegir color personalizado"
                  />
                  <span className="text-[11px] text-default-400">
                    O selecciona cualquier otro color personalizado con el selector nativo
                  </span>
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between">
              <Button
                variant="light"
                color="default"
                radius="lg"
                onPress={onClose}
                isDisabled={isSubmitting}
                size="sm"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                color="primary"
                radius="lg"
                size="sm"
                isLoading={isSubmitting}
                startContent={!isSubmitting && (isEditing ? <LuSave size={16} /> : <LuFolderPlus size={16} />)}
                className="font-semibold shadow-sm px-5"
              >
                {isEditing ? "Guardar Cambios" : "Crear Categoría"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
