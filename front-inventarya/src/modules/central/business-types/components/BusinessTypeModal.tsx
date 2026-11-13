import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Switch,
} from "@nextui-org/react";
import { LuBriefcase } from "react-icons/lu";
import { IBusinessType } from "../interfaces/business-type.interface";
import { useBusinessTypesStore } from "../store/businessTypes.store";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  businessType?: IBusinessType;
  onSuccess?: () => void;
}

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const BusinessTypeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  businessType,
  onSuccess,
}) => {
  const { createBusinessType, updateBusinessType, isSaving } = useBusinessTypesStore();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    if (businessType) {
      setName(businessType.name || "");
      setSlug(businessType.slug || "");
      setSlugTouched(true);
      setDescription(businessType.description || "");
      setIsActive(Boolean(businessType.is_active));
    } else {
      setName("");
      setSlug("");
      setSlugTouched(false);
      setDescription("");
      setIsActive(true);
    }
  }, [businessType, isOpen]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched) {
      setSlug(toSlug(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      slug: slug.trim() || toSlug(name),
      description: description.trim() || null,
      is_active: isActive,
    };

    const ok = businessType
      ? await updateBusinessType(businessType.id, payload)
      : await createBusinessType(payload);

    if (ok) {
      onSuccess?.();
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" backdrop="blur">
      <ModalContent>
        {(close) => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="flex items-center gap-2 border-b border-divider">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <LuBriefcase size={18} />
              </div>
              <span>{businessType ? "Editar Tipo de Negocio" : "Nuevo Tipo de Negocio"}</span>
            </ModalHeader>

            <ModalBody className="py-5 flex flex-col gap-4">
              <Input
                isRequired
                label="Nombre"
                placeholder="Ej: Farmacia, Ferretería..."
                labelPlacement="outside"
                variant="bordered"
                value={name}
                onValueChange={handleNameChange}
              />

              <Input
                isRequired
                label="Slug"
                placeholder="ej: farmacia"
                labelPlacement="outside"
                variant="bordered"
                value={slug}
                onValueChange={(val) => {
                  setSlugTouched(true);
                  setSlug(toSlug(val));
                }}
                description="Identificador único en minúsculas y guiones. Se genera automáticamente desde el nombre."
              />

              <Textarea
                label="Descripción"
                placeholder="Describe brevemente este tipo de negocio..."
                labelPlacement="outside"
                variant="bordered"
                minRows={2}
                value={description}
                onValueChange={setDescription}
              />

              <div className="flex items-center justify-between p-3 rounded-xl border border-divider bg-default-50/50">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">Estado activo</span>
                  <span className="text-xs text-default-500">
                    Solo los tipos activos pueden seleccionarse al crear nuevos tenants.
                  </span>
                </div>
                <Switch isSelected={isActive} onValueChange={setIsActive} color="success" />
              </div>
            </ModalBody>

            <ModalFooter className="border-t border-divider">
              <Button variant="light" onPress={close} isDisabled={isSaving}>
                Cancelar
              </Button>
              <Button color="primary" type="submit" isLoading={isSaving} isDisabled={!name.trim()}>
                {businessType ? "Guardar Cambios" : "Crear Tipo"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};

