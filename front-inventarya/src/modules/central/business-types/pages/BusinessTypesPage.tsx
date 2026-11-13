import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Chip,
  Input,
  Card,
  CardBody,
  Pagination,
  Tooltip,
  useDisclosure,
} from "@nextui-org/react";
import {
  LuPlus,
  LuSearch,
  LuPencil,
  LuTrash2,
  LuPower,
  LuSettings2,
  LuBriefcase,
} from "react-icons/lu";
import { ConfirmModal, DynamicBreadcrumbs } from "@/components";
import { useCentralAuthStore } from "@/modules/auth/store/centralAuth.store";
import { useBusinessTypesStore } from "../store/businessTypes.store";
import { IBusinessType } from "../interfaces/business-type.interface";
import { BusinessTypeModal } from "../components/BusinessTypeModal";

export const BusinessTypesPage: React.FC = () => {
  const navigate = useNavigate();
  const can = useCentralAuthStore((state) => state.can);
  const canManage = can("business-types:manage");

  const {
    businessTypes,
    meta,
    isLoading,
    isSaving,
    getBusinessTypes,
    toggleBusinessTypeStatus,
    deleteBusinessType,
  } = useBusinessTypesStore();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { isOpen: isModalOpen, onOpen: openModal, onClose: closeModal } = useDisclosure();
  const [selectedType, setSelectedType] = useState<IBusinessType | undefined>(undefined);

  const [deleteTarget, setDeleteTarget] = useState<IBusinessType | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      getBusinessTypes({ search: search.trim() || undefined, page, per_page: 15 });
    }, 250);
    return () => clearTimeout(timer);
  }, [search, page, getBusinessTypes]);

  const refreshList = () => {
    getBusinessTypes({ search: search.trim() || undefined, page, per_page: 15 });
  };

  const handleCreate = () => {
    setSelectedType(undefined);
    openModal();
  };

  const handleEdit = (bt: IBusinessType) => {
    setSelectedType(bt);
    openModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteBusinessType(deleteTarget.id);
    if (res.success) {
      setDeleteTarget(null);
      refreshList();
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[95rem] mx-auto w-full pb-10">
      <DynamicBreadcrumbs title="Tipos de Negocio" />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-default-900 flex items-center gap-2">
            <LuBriefcase className="text-primary" />
            Tipos de Negocio
          </h1>
          <p className="text-default-500 text-sm mt-0.5">
            Configura los rubros comerciales y los campos adicionales de sus productos.
          </p>
        </div>

        {canManage && (
          <Button
            color="primary"
            startContent={<LuPlus size={18} />}
            onPress={handleCreate}
            className="font-bold shadow-md shadow-primary-500/20"
          >
            Nuevo tipo de negocio
          </Button>
        )}
      </div>

      <Card className="border border-divider shadow-sm bg-content1 rounded-2xl">
        <CardBody className="p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <Input
              isClearable
              className="w-full sm:max-w-sm"
              placeholder="Buscar por nombre..."
              startContent={<LuSearch className="text-default-400" />}
              value={search}
              onClear={() => {
                setSearch("");
                setPage(1);
              }}
              onValueChange={(val) => {
                setSearch(val);
                setPage(1);
              }}
            />
            <span className="text-xs text-default-500 font-medium">
              {meta.total} tipo(s) registrado(s)
            </span>
          </div>

          <Table aria-label="Tabla de tipos de negocio" removeWrapper>
            <TableHeader>
              <TableColumn>NOMBRE</TableColumn>
              <TableColumn>DESCRIPCIÓN</TableColumn>
              <TableColumn align="center">CAMPOS</TableColumn>
              <TableColumn align="center">TENANTS</TableColumn>
              <TableColumn align="center">ESTADO</TableColumn>
              <TableColumn align="end">ACCIONES</TableColumn>
            </TableHeader>
            <TableBody
              items={businessTypes}
              isLoading={isLoading}
              loadingContent="Cargando tipos de negocio..."
              emptyContent="No se encontraron tipos de negocio."
            >
              {(item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{item.name}</span>
                      <span className="text-xs font-mono text-default-400">{item.slug}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-default-600 line-clamp-2">
                      {item.description || "Sin descripción"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Chip size="sm" variant="flat" color="primary" className="font-bold">
                        {item.fields_count ?? 0}
                      </Chip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Chip size="sm" variant="flat" color="secondary" className="font-bold">
                        {item.tenants_count ?? 0}
                      </Chip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={item.is_active ? "success" : "default"}
                        className="font-semibold"
                      >
                        {item.is_active ? "Activo" : "Inactivo"}
                      </Chip>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end items-center gap-1">
                      <Tooltip content="Configurar campos de productos">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          startContent={<LuSettings2 size={14} />}
                          onPress={() => navigate(`/business-types/${item.id}`)}
                        >
                          Campos
                        </Button>
                      </Tooltip>

                      {canManage && (
                        <>
                          <Tooltip content="Editar">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => handleEdit(item)}
                            >
                              <LuPencil size={16} />
                            </Button>
                          </Tooltip>

                          <Tooltip content={item.is_active ? "Desactivar" : "Activar"}>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color={item.is_active ? "warning" : "success"}
                              isDisabled={isSaving}
                              onPress={() => toggleBusinessTypeStatus(item.id)}
                            >
                              <LuPower size={16} />
                            </Button>
                          </Tooltip>

                          <Tooltip
                            content={
                              (item.tenants_count ?? 0) > 0
                                ? "Tiene tenants asociados (desactívalo en su lugar)"
                                : "Eliminar"
                            }
                          >
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              isDisabled={(item.tenants_count ?? 0) > 0}
                              onPress={() => setDeleteTarget(item)}
                            >
                              <LuTrash2 size={16} />
                            </Button>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {meta.last_page > 1 && (
            <div className="flex justify-center pt-2">
              <Pagination
                total={meta.last_page}
                page={page}
                onChange={setPage}
                showControls
                color="primary"
                size="sm"
              />
            </div>
          )}
        </CardBody>
      </Card>

      <BusinessTypeModal
        isOpen={isModalOpen}
        onClose={closeModal}
        businessType={selectedType}
        onSuccess={refreshList}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar Tipo de Negocio?"
        description={`Se eliminará permanentemente "${deleteTarget?.name || ""}" y todos sus campos configurados.`}
        isLoading={isSaving}
      />
    </div>
  );
};

