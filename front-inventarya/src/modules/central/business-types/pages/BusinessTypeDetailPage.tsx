import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  useDisclosure,
} from "@nextui-org/react";
import {
  LuArrowLeft,
  LuArrowUp,
  LuArrowDown,
  LuPlus,
  LuPencil,
  LuPower,
  LuTrash2,
  LuBriefcase,
} from "react-icons/lu";
import { ConfirmModal, DynamicBreadcrumbs } from "@/components";
import { useCentralAuthStore } from "@/modules/auth/store/centralAuth.store";
import { useBusinessTypesStore } from "../store/businessTypes.store";
import { IBusinessTypeField } from "../interfaces/business-type.interface";
import { BusinessTypeModal } from "../components/BusinessTypeModal";
import { BusinessTypeFieldModal } from "../components/BusinessTypeFieldModal";

export const BusinessTypeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const can = useCentralAuthStore((state) => state.can);
  const canManage = can("business-types:manage");

  const {
    currentType,
    fields,
    isLocked,
    isLoading,
    isSaving,
    getBusinessTypeDetail,
    toggleFieldStatus,
    deleteField,
    reorderFields,
  } = useBusinessTypesStore();

  const { isOpen: isEditTypeOpen, onOpen: openEditType, onClose: closeEditType } = useDisclosure();
  const { isOpen: isFieldModalOpen, onOpen: openFieldModal, onClose: closeFieldModal } = useDisclosure();

  const [selectedField, setSelectedField] = useState<IBusinessTypeField | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<IBusinessTypeField | null>(null);

  const typeId = Number(id);

  useEffect(() => {
    if (!Number.isNaN(typeId) && typeId > 0) {
      getBusinessTypeDetail(typeId);
    }
  }, [typeId, getBusinessTypeDetail]);

  const handleAddField = () => {
    setSelectedField(undefined);
    openFieldModal();
  };

  const handleEditField = (field: IBusinessTypeField) => {
    setSelectedField(field);
    openFieldModal();
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    await reorderFields(typeId, next.map((f) => f.id));
  };

  const handleConfirmDeleteField = async () => {
    if (!deleteTarget) return;
    const ok = await deleteField(typeId, deleteTarget.id);
    if (ok) {
      setDeleteTarget(null);
    }
  };

  if (isLoading && !currentType) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Spinner size="lg" color="primary" />
        <p className="text-sm text-default-500">Cargando tipo de negocio...</p>
      </div>
    );
  }

  if (!currentType) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <p className="text-default-500">Tipo de negocio no encontrado.</p>
        <Button variant="flat" onPress={() => navigate("/business-types")}>
          Volver al listado
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[95rem] mx-auto w-full pb-10">
      <DynamicBreadcrumbs title={currentType.name} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="flat"
            onPress={() => navigate("/business-types")}
            aria-label="Volver"
          >
            <LuArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-default-900 flex items-center gap-2">
                <LuBriefcase className="text-primary" />
                {currentType.name}
              </h1>
              <Chip size="sm" variant="flat" color={currentType.is_active ? "success" : "default"}>
                {currentType.is_active ? "Activo" : "Inactivo"}
              </Chip>
              <Chip size="sm" variant="flat" color="secondary">
                {currentType.tenants_count ?? 0} tenant(s)
              </Chip>
            </div>
            <p className="text-xs sm:text-sm text-default-500 mt-0.5">
              Slug: <span className="font-mono">{currentType.slug}</span>
              {currentType.description ? ` — ${currentType.description}` : ""}
            </p>
          </div>
        </div>

        {canManage && (
          <Button variant="flat" startContent={<LuPencil size={16} />} onPress={openEditType}>
            Editar Tipo
          </Button>
        )}
      </div>

      {/* Sección Campos de productos */}
      <Card className="border border-divider shadow-sm bg-content1 rounded-2xl">
        <CardHeader className="px-5 py-4 border-b border-divider flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Campos de productos</h2>
            <p className="text-xs text-default-500">
              Define los atributos adicionales que completarán los tenants de este rubro al registrar productos.
            </p>
          </div>

          {canManage && (
            <Button
              color="primary"
              size="sm"
              startContent={<LuPlus size={16} />}
              onPress={handleAddField}
              className="font-bold"
            >
              Agregar campo
            </Button>
          )}
        </CardHeader>

        <CardBody className="p-5">
          <Table aria-label="Campos de productos del tipo de negocio" removeWrapper>
            <TableHeader>
              <TableColumn>ORDEN</TableColumn>
              <TableColumn>ETIQUETA</TableColumn>
              <TableColumn>CLAVE INTERNA</TableColumn>
              <TableColumn>TIPO</TableColumn>
              <TableColumn align="center">OBLIGATORIO</TableColumn>
              <TableColumn align="center">ESTADO</TableColumn>
              <TableColumn align="end">ACCIONES</TableColumn>
            </TableHeader>
            <TableBody
              items={fields}
              emptyContent="Este tipo de negocio aún no tiene campos configurados."
            >
              {(field) => {
                const index = fields.findIndex((f) => f.id === field.id);
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-default-500 w-5">
                          {index + 1}
                        </span>
                        {canManage && (
                          <div className="flex items-center">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              isDisabled={index === 0 || isSaving}
                              onPress={() => handleMove(index, -1)}
                              aria-label="Subir"
                            >
                              <LuArrowUp size={14} />
                            </Button>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              isDisabled={index === fields.length - 1 || isSaving}
                              onPress={() => handleMove(index, 1)}
                              aria-label="Bajar"
                            >
                              <LuArrowDown size={14} />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-foreground">{field.label}</span>
                        {field.type === "select" && field.options && field.options.length > 0 && (
                          <span className="text-[11px] text-default-400">
                            Opciones: {field.options.join(", ")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs bg-default-100 px-2 py-0.5 rounded">
                        {field.key}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" color="default" className="font-mono text-xs">
                        {field.type}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={field.is_required ? "warning" : "default"}
                        >
                          {field.is_required ? "Sí" : "No"}
                        </Chip>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={field.is_active ? "success" : "default"}
                        >
                          {field.is_active ? "Activo" : "Inactivo"}
                        </Chip>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <div className="flex justify-end items-center gap-1">
                          <Tooltip content="Editar campo">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => handleEditField(field)}
                            >
                              <LuPencil size={15} />
                            </Button>
                          </Tooltip>

                          <Tooltip content={field.is_active ? "Desactivar" : "Activar"}>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color={field.is_active ? "warning" : "success"}
                              isDisabled={isSaving}
                              onPress={() => toggleFieldStatus(typeId, field.id)}
                            >
                              <LuPower size={15} />
                            </Button>
                          </Tooltip>

                          <Tooltip
                            content={
                              isLocked
                                ? "Tipo en uso: desactívalo en lugar de eliminarlo"
                                : "Eliminar campo"
                            }
                          >
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              isDisabled={isLocked}
                              onPress={() => setDeleteTarget(field)}
                            >
                              <LuTrash2 size={15} />
                            </Button>
                          </Tooltip>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              }}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      <BusinessTypeModal
        isOpen={isEditTypeOpen}
        onClose={closeEditType}
        businessType={currentType}
        onSuccess={() => getBusinessTypeDetail(typeId)}
      />

      <BusinessTypeFieldModal
        isOpen={isFieldModalOpen}
        onClose={closeFieldModal}
        businessTypeId={typeId}
        field={selectedField}
        isLocked={isLocked}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteField}
        title="¿Eliminar campo?"
        description={`Se eliminará el campo "${deleteTarget?.label || ""}" (${deleteTarget?.key || ""}).`}
        isLoading={isSaving}
      />
    </div>
  );
};

