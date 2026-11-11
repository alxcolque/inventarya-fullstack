import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tabs,
  Tab,
  Input,
  Chip,
  Tooltip,
} from "@nextui-org/react";
import {
  LuDatabase,
  LuServer,
  LuTable,
  LuTrash2,
  LuRefreshCw,
  LuSearch,
  LuInfo,
  LuEye,
} from "react-icons/lu";
import { useTenantsStore } from "../store/tenants.store";
import { ITenant } from "@/interface";
import { ConfirmModal } from "@/components";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tenant?: ITenant;
}

interface TableStats {
  name: string;
  rows: number;
}

interface DBInfo {
  database: string;
  host: string;
  tables: TableStats[];
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

interface TablePreviewData {
  table: string;
  columns: ColumnInfo[];
  rows: any[];
}

export const TenantDatabaseModal = ({ isOpen, onClose, tenant }: Props) => {
  const { getTenantDatabaseInfo, getTablePreview, clearTableData } = useTenantsStore();

  const [dbInfo, setDbInfo] = useState<DBInfo | null>(null);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TablePreviewData | null>(null);

  // Search filter for tables
  const [searchQuery, setSearchQuery] = useState("");

  // Loading states
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(false);

  // Truncate confirm modal state
  const [isTruncateOpen, setIsTruncateOpen] = useState(false);
  const [tableToTruncate, setTableToTruncate] = useState<string | null>(null);
  const [isTruncating, setIsTruncating] = useState(false);

  const fetchDbInfo = async () => {
    if (!tenant) return;
    setIsDbLoading(true);
    const data = await getTenantDatabaseInfo(tenant.id);
    if (data) {
      setDbInfo(data);
    }
    setIsDbLoading(false);
  };

  const fetchTablePreview = async (tableName: string) => {
    if (!tenant) return;
    setIsTableLoading(true);
    const data = await getTablePreview(tenant.id, tableName);
    if (data) {
      setTableData(data as TablePreviewData);
    }
    setIsTableLoading(false);
  };

  // Fetch db info when modal opens
  useEffect(() => {
    if (isOpen && tenant) {
      setDbInfo(null);
      setActiveTable(null);
      setTableData(null);
      setSearchQuery("");
      fetchDbInfo();
    }
  }, [isOpen, tenant]);

  // Fetch table data when active table changes
  useEffect(() => {
    if (activeTable) {
      fetchTablePreview(activeTable);
    } else {
      setTableData(null);
    }
  }, [activeTable]);

  // Filtered tables list
  const filteredTables = useMemo(() => {
    if (!dbInfo?.tables) return [];
    return dbInfo.tables.filter((t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [dbInfo, searchQuery]);

  const handleTruncateClick = (tableName: string) => {
    if (tableName === "migrations") return;
    setTableToTruncate(tableName);
    setIsTruncateOpen(true);
  };

  const handleConfirmTruncate = async () => {
    if (!tenant || !tableToTruncate) return;
    setIsTruncating(true);
    const success = await clearTableData(tenant.id, tableToTruncate);
    if (success) {
      // Refresh DB info for stats
      await fetchDbInfo();
      // Refresh active table preview
      if (activeTable === tableToTruncate) {
        await fetchTablePreview(tableToTruncate);
      }
    }
    setIsTruncating(false);
    setIsTruncateOpen(false);
    setTableToTruncate(null);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="5xl"
        backdrop="blur"
        scrollBehavior="inside"
        classNames={{
          base: "bg-background/95 dark:bg-background/95 border border-default-100 shadow-2xl",
          header: "border-b border-default-100 py-4",
          footer: "border-t border-default-100 py-3",
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/50 text-primary">
                      <LuDatabase className="text-xl" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Gestión de Base de Datos</h3>
                      <p className="text-xs text-default-500 font-normal">
                        Entorno dedicado para {tenant?.name} ({tenant?.id})
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={<LuRefreshCw size={14} />}
                    onClick={fetchDbInfo}
                    isLoading={isDbLoading}
                  >
                    Actualizar
                  </Button>
                </div>
              </ModalHeader>

              <ModalBody className="p-6">
                {isDbLoading && !dbInfo ? (
                  <div className="flex flex-col items-center justify-center min-h-[350px] gap-3">
                    <Spinner size="lg" label="Conectando e inspeccionando base de datos..." />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[450px]">
                    {/* LEFT PANEL - TABLES SIDEBAR */}
                    <div className="md:col-span-4 flex flex-col gap-4 border-r border-default-100 pr-4">
                      {/* Database Info Card */}
                      <Card className="border-none shadow-none bg-default-50/50">
                        <CardBody className="p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-default-400 flex items-center gap-1 font-medium">
                              <LuDatabase size={12} /> BD:
                            </span>
                            <span className="font-mono font-bold text-default-700">
                              {dbInfo?.database || (tenant?.database ? `tenant_${tenant.database}` : "Cargando...")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-default-400 flex items-center gap-1 font-medium">
                              <LuServer size={12} /> HOST:
                            </span>
                            <span className="font-mono text-default-500">
                              {dbInfo?.host || "postgres"}
                            </span>
                          </div>
                        </CardBody>
                      </Card>

                      {/* Search Tables */}
                      <Input
                        size="sm"
                        placeholder="Buscar tabla..."
                        startContent={<LuSearch className="text-default-400" />}
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        isClearable
                      />

                      {/* Tables List */}
                      <div className="flex flex-col gap-1 overflow-y-auto max-h-[300px] pr-1">
                        <span className="text-xs font-semibold text-default-400 px-2 pb-1">
                          TABLAS DISPONIBLES ({filteredTables.length})
                        </span>
                        {filteredTables.length === 0 ? (
                          <div className="text-center py-4 text-xs text-default-400">
                            No se encontraron tablas
                          </div>
                        ) : (
                          filteredTables.map((t) => (
                            <button
                              key={t.name}
                              onClick={() => setActiveTable(t.name)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                                activeTable === t.name
                                  ? "bg-primary text-primary-foreground font-semibold shadow-md"
                                  : "hover:bg-default-100 text-default-700"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <LuTable size={14} className={activeTable === t.name ? "text-primary-foreground" : "text-default-400"} />
                                <span className="truncate">{t.name}</span>
                              </div>
                              <Chip
                                size="sm"
                                variant={activeTable === t.name ? "solid" : "flat"}
                                color={activeTable === t.name ? "default" : "primary"}
                                className={`h-5 min-w-8 text-[10px] ${
                                  activeTable === t.name ? "bg-white/20 text-white font-bold" : ""
                                }`}
                              >
                                {t.rows}
                              </Chip>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    {/* RIGHT PANEL - DETAILED TABLE INSPECTOR */}
                    <div className="md:col-span-8 flex flex-col gap-4">
                      {!activeTable ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-center bg-default-50/20 border border-dashed border-default-200 rounded-xl p-8">
                          <div className="p-4 rounded-full bg-default-100 text-default-400 mb-3">
                            <LuTable size={32} />
                          </div>
                          <h4 className="text-base font-bold text-default-700">Ninguna tabla seleccionada</h4>
                          <p className="text-xs text-default-400 max-w-[280px] mt-1">
                            Seleccione una tabla de la lista de la izquierda para ver su estructura e inspeccionar o vaciar sus registros.
                          </p>
                        </div>
                      ) : isTableLoading && !tableData ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[350px]">
                          <Spinner size="md" label={`Cargando tabla '${activeTable}'...`} />
                        </div>
                      ) : tableData ? (
                        <div className="flex flex-col gap-4 h-full">
                          {/* Table Header Details */}
                          <div className="flex items-center justify-between gap-4 bg-default-50/50 p-3 rounded-lg border border-default-100">
                            <div className="flex items-center gap-2">
                              <LuTable className="text-primary text-lg" />
                              <span className="font-mono text-base font-bold text-default-800">
                                {tableData.table}
                              </span>
                            </div>
                            <Button
                              size="sm"
                              color="danger"
                              variant="flat"
                              startContent={<LuTrash2 size={14} />}
                              isDisabled={tableData.table === "migrations"}
                              onClick={() => handleTruncateClick(tableData.table)}
                            >
                              Vaciar Tabla
                            </Button>
                          </div>

                          {/* Data and Structure Tabs */}
                          <Tabs color="primary" variant="underlined" size="sm" classNames={{ panel: "pt-2 flex-grow overflow-hidden flex flex-col" }}>
                            <Tab
                              key="data"
                              title={
                                <div className="flex items-center gap-2">
                                  <LuEye size={14} />
                                  <span>Registros ({tableData.rows.length})</span>
                                </div>
                              }
                            >
                              {tableData.rows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center bg-default-50/10 rounded-xl border border-default-100">
                                  <LuInfo size={24} className="text-default-400 mb-2" />
                                  <span className="text-sm font-semibold text-default-600">Tabla vacía</span>
                                  <span className="text-xs text-default-400 mt-0.5">Esta tabla no contiene ningún registro.</span>
                                </div>
                              ) : (
                                <div className="overflow-x-auto max-h-[280px] border border-default-100 rounded-lg">
                                  <Table
                                    aria-label="Registros de la tabla"
                                    removeWrapper
                                    classNames={{
                                      th: "bg-default-100/70 text-default-600 font-bold font-mono text-xs py-2",
                                      td: "font-mono text-xs py-1.5",
                                    }}
                                  >
                                    <TableHeader>
                                      {tableData.columns.map((col) => (
                                        <TableColumn key={col.column_name}>
                                          {col.column_name}
                                        </TableColumn>
                                      ))}
                                    </TableHeader>
                                    <TableBody>
                                      {tableData.rows.map((row, index) => (
                                        <TableRow key={index}>
                                          {tableData.columns.map((col) => {
                                            const cellVal = row[col.column_name];
                                            let cellText = "";
                                            if (cellVal === null) {
                                              cellText = "NULL";
                                            } else if (typeof cellVal === "object") {
                                              cellText = JSON.stringify(cellVal);
                                            } else {
                                              cellText = String(cellVal);
                                            }
                                            return (
                                              <TableCell key={col.column_name}>
                                                <span className={cellVal === null ? "text-default-300 italic" : "text-default-700"}>
                                                  {cellText}
                                                </span>
                                              </TableCell>
                                            );
                                          })}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                              {tableData.rows.length >= 100 && (
                                <p className="text-[10px] text-default-400 mt-2 italic flex items-center gap-1">
                                  <LuInfo size={10} /> Mostrando únicamente los primeros 100 registros.
                                </p>
                              )}
                            </Tab>

                            <Tab
                              key="structure"
                              title={
                                <div className="flex items-center gap-2">
                                  <LuInfo size={14} />
                                  <span>Estructura</span>
                                </div>
                              }
                            >
                              <div className="overflow-y-auto max-h-[300px] border border-default-100 rounded-lg">
                                <Table
                                  aria-label="Estructura de la tabla"
                                  removeWrapper
                                  classNames={{
                                    th: "bg-default-100/70 text-default-600 font-bold text-xs py-2",
                                    td: "text-xs py-2",
                                  }}
                                >
                                  <TableHeader>
                                    <TableColumn>COLUMNA</TableColumn>
                                    <TableColumn>TIPO DE DATO</TableColumn>
                                    <TableColumn align="center">NULABLE</TableColumn>
                                  </TableHeader>
                                  <TableBody>
                                    {tableData.columns.map((col) => (
                                      <TableRow key={col.column_name}>
                                        <TableCell className="font-mono font-semibold text-default-800">
                                          {col.column_name}
                                        </TableCell>
                                        <TableCell className="font-mono text-default-600">
                                          {col.data_type}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex justify-center">
                                            <Chip
                                              size="sm"
                                              variant="flat"
                                              color={col.is_nullable === "YES" ? "success" : "default"}
                                              className="h-5"
                                            >
                                              {col.is_nullable === "YES" ? "Sí" : "No"}
                                            </Chip>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </Tab>
                          </Tabs>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </ModalBody>

              <ModalBody className="pb-6 pt-0">
                <div className="flex items-center gap-2 text-warning bg-warning-50 dark:bg-warning-950/20 p-3 rounded-lg border border-warning-200/50">
                  <LuInfo className="flex-shrink-0 text-warning" size={16} />
                  <span className="text-xs text-warning-800 dark:text-warning-300">
                    <strong>Atención:</strong> Las operaciones de borrado afectarán directamente la base de datos de producción de este inquilino. Proceda con extrema precaución.
                  </span>
                </div>
              </ModalBody>

              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Cerrar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* CONFIRM TRUNCATE MODAL */}
      <ConfirmModal
        isOpen={isTruncateOpen}
        onClose={() => setIsTruncateOpen(false)}
        onConfirm={handleConfirmTruncate}
        title={`¿Vaciar tabla '${tableToTruncate}'?`}
        description={`Esta acción borrará permanentemente TODOS los registros de la tabla '${tableToTruncate}' en cascada. Esta operación no se puede deshacer.`}
        isLoading={isTruncating}
      />
    </>
  );
};
