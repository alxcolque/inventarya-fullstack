import React, { useEffect } from "react";
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
import { useForm, Controller } from "react-hook-form";
import { IFaqItem } from "../interfaces/configuration.interface";
import { useCentralSettingsStore } from "../store/settings.store";

interface FaqModalProps {
  isOpen: boolean;
  onClose: () => void;
  faq?: IFaqItem | null;
}

interface FormValues {
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
}

export const FaqModal: React.FC<FaqModalProps> = ({ isOpen, onClose, faq }) => {
  const { createFaq, updateFaq, isSavingFaq } = useCentralSettingsStore();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      question: "",
      answer: "",
      category: "",
      sort_order: 0,
      is_published: true,
    },
  });

  useEffect(() => {
    if (faq) {
      reset({
        question: faq.question,
        answer: faq.answer,
        category: faq.category || "",
        sort_order: faq.sort_order || 0,
        is_published: faq.is_published,
      });
    } else {
      reset({
        question: "",
        answer: "",
        category: "VARIOS",
        sort_order: 0,
        is_published: true,
      });
    }
  }, [faq, reset, isOpen]);

  const onSubmit = async (values: FormValues) => {
    let success = false;
    if (faq) {
      success = await updateFaq(faq.id, values);
    } else {
      success = await createFaq(values);
    }

    if (success) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" placement="center">
      <ModalContent>
        {(onCloseModal) => (
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader className="flex flex-col gap-1">
              <span className="text-xl font-bold">
                {faq ? "Editar Pregunta Frecuente" : "Nueva Pregunta Frecuente"}
              </span>
              <span className="text-xs text-default-500 font-normal">
                Esta pregunta aparecerá en la Landing Page del Sistema de Inventarios.
              </span>
            </ModalHeader>

            <ModalBody className="gap-4">
              <Input
                label="Pregunta"
                placeholder="Ej. ¿Cómo funciona el control de inventario?"
                variant="bordered"
                isRequired
                {...register("question", { required: "La pregunta es obligatoria" })}
                isInvalid={!!errors.question}
                errorMessage={errors.question?.message}
              />

              <Textarea
                label="Respuesta detallada"
                placeholder="Explica detalladamente la respuesta que verá el visitante..."
                variant="bordered"
                minRows={4}
                isRequired
                {...register("answer", { required: "La respuesta es obligatoria" })}
                isInvalid={!!errors.answer}
                errorMessage={errors.answer?.message}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Categoría"
                  placeholder="Ej. General, POS, Inventarios, Facturación"
                  variant="bordered"
                  {...register("category")}
                />

                <Input
                  label="Orden de Aparición"
                  type="number"
                  placeholder="0"
                  variant="bordered"
                  {...register("sort_order", { valueAsNumber: true })}
                  description="Números menores aparecen primero"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-default-50 border border-default-200">
                <div>
                  <p className="text-sm font-semibold">Estado de Publicación</p>
                  <p className="text-xs text-default-400">
                    Visible inmediatamente para los visitantes de la Landing Page
                  </p>
                </div>
                <Controller
                  name="is_published"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <Switch isSelected={value} onValueChange={onChange} color="primary" />
                  )}
                />
              </div>
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={onCloseModal} isDisabled={isSavingFaq}>
                Cancelar
              </Button>
              <Button color="primary" type="submit" isLoading={isSavingFaq}>
                {faq ? "Actualizar" : "Guardar Pregunta"}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
