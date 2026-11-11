import { useEffect, useRef, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Avatar,
} from "@nextui-org/react";
import { LuTag, LuUploadCloud, LuTrash2, LuImage } from "react-icons/lu";
import { toast } from "sonner";
import { IBrandResponse } from "@/interface";
import { getImageUrl } from "@/utils/image";

interface BrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; image?: string | null }) => Promise<boolean>;
  initialData: Partial<IBrandResponse> | null;
  isEditing: boolean;
}

export const getBrandImageUrl = getImageUrl;

export const BrandModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing,
}: BrandModalProps) => {
  const [name, setName] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || "");
        if (initialData.image) {
          setImagePreview(getBrandImageUrl(initialData.image));
          setImageBase64(null); // Keep unchanged unless user selects new
        } else {
          setImagePreview(null);
          setImageBase64(null);
        }
      } else {
        setName("");
        setImagePreview(null);
        setImageBase64(null);
      }
      setIsSubmitting(false);
    }
  }, [isOpen, initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP)");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen supera el límite de 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      toast.error("El nombre de la marca es obligatorio");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: { name: string; image?: string | null } = {
        name: trimmedName,
      };

      if (imageBase64) {
        payload.image = imageBase64;
      } else if (imagePreview === null && initialData?.image) {
        payload.image = null; // User explicitly removed it
      }

      const success = await onSubmit(payload);
      if (success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      backdrop="blur"
      placement="center"
      classNames={{
        base: "border-none shadow-2xl rounded-3xl bg-background overflow-hidden",
        header: "border-b border-divider/40 px-5 py-4",
        body: "px-5 py-4",
        footer: "border-t border-divider/40 px-5 py-3",
      }}
    >
      <ModalContent>
        {() => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/40 text-primary">
                <LuTag size={18} />
              </div>
              <div className="flex flex-col">
                <h3 className="text-base font-bold text-default-900 leading-tight">
                  {isEditing ? "Editar Marca" : "Nueva Marca"}
                </h3>
                <span className="text-[11px] text-default-400 font-normal">
                  {isEditing
                    ? "Actualiza los datos del fabricante o marca comercial"
                    : "Registra una nueva marca para catalogar tus productos"}
                </span>
              </div>
            </ModalHeader>

            <ModalBody className="flex flex-col gap-4">
              {/* Nombre de la Marca */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-700">
                  Nombre de la Marca <span className="text-danger">*</span>
                </label>
                <Input
                  placeholder="Ej. Apple, Adidas, Nestlé, Sony..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  radius="lg"
                  size="sm"
                  variant="flat"
                  className="w-full"
                  isRequired
                />
              </div>

              {/* Logo / Imagen de la Marca */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-default-700">
                  Logotipo o Imagen <span className="text-[11px] font-normal text-default-400">(Opcional)</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="relative flex items-center gap-3 p-2.5 rounded-2xl bg-default-50/70 border border-divider/50">
                    <Avatar
                      src={imagePreview}
                      alt={name || "Preview"}
                      radius="lg"
                      className="w-14 h-14 shrink-0 bg-default-100 object-cover"
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-semibold text-default-800 truncate">
                        {name ? `${name} - Logotipo` : "Logotipo seleccionado"}
                      </span>
                      <span className="text-[10px] text-default-400">
                        {imageBase64 ? "Nueva imagen lista para guardar" : "Imagen actual"}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="flat"
                          color="primary"
                          className="text-[10px] h-6 px-2"
                          onPress={() => fileInputRef.current?.click()}
                        >
                          Cambiar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="light"
                          color="danger"
                          startContent={<LuTrash2 size={12} />}
                          className="text-[10px] h-6 px-2 text-danger"
                          onPress={handleRemoveImage}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl border-2 border-dashed border-default-200 hover:border-primary/60 bg-default-50/30 hover:bg-default-100/40 cursor-pointer transition-all text-center"
                  >
                    <div className="p-2 rounded-xl bg-default-100 text-default-500">
                      <LuUploadCloud size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-default-700">
                        Selecciona o sube un logotipo
                      </span>
                      <span className="text-[10px] text-default-400">
                        PNG, JPG o WEBP (máximo 2MB)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="flat"
                onPress={onClose}
                isDisabled={isSubmitting}
                className="text-xs font-medium"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                color="primary"
                variant="solid"
                isLoading={isSubmitting}
                className="text-xs font-semibold px-4 shadow-sm"
              >
                {isEditing ? "Guardar Cambios" : "Crear Marca"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
