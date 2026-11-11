import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Switch,
  Tabs,
  Tab,
  Chip,
  Card,
  CardBody,
  Divider,
} from "@nextui-org/react";
import {
  LuStore,
  LuMapPin,
  LuPhone,
  LuCamera,
  LuX,
  LuCheck,
  LuSatellite,
  LuInfo,
  LuLayers,
  LuReceipt,
  LuAlertTriangle,
} from "react-icons/lu";
import { SatelliteLocationPicker } from "./SatelliteLocationPicker";
import { toast } from "sonner";
import { getImageUrl } from "@/utils";
import { useSettingStore } from "../../../store/settings/settings.store";

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: Record<string, any>) => Promise<boolean | any>;
  initialData?: Record<string, any> | null;
  isEditing?: boolean;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>("info");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Setting store to verify tenant electronic invoicing status
  const setting = useSettingStore((state) => state.setting);
  const systemData = useSettingStore((state) => state.systemData);
  const isTenantInvoicingEnabled = Boolean(
    setting?.electronic_invoicing_enabled ?? systemData?.electronic_invoicing_enabled
  );

  // Form states
  const [name, setName] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [location, setLocation] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePayload, setImagePayload] = useState<string | null>(null);
  const [enableCustomers, setEnableCustomers] = useState<boolean>(false);
  const [enablePayment, setEnablePayment] = useState<boolean>(false);
  const [enableObservations, setEnableObservations] = useState<boolean>(false);
  const [enableDiscount, setEnableDiscount] = useState<boolean>(false);
  const [enableElectronicInvoicing, setEnableElectronicInvoicing] = useState<boolean>(false);
  const [sinBranchCode, setSinBranchCode] = useState<string>("");
  const [sinPointOfSaleCode, setSinPointOfSaleCode] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialData when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || "");
        setAddress(initialData.address || "");
        setPhone(initialData.phone || "");
        setIsActive(
          initialData.is_active !== undefined ? Boolean(initialData.is_active) : true
        );
        setLocation(initialData.location || "");
        const img = initialData.front_image ? getImageUrl(initialData.front_image) : null;
        setImagePreview(img);
        setImagePayload(initialData.front_image || null);
        setEnableCustomers(Boolean(initialData.enable_customers));
        setEnablePayment(Boolean(initialData.enable_payment));
        setEnableObservations(Boolean(initialData.enable_observations));
        setEnableDiscount(Boolean(initialData.enable_discount));
        setEnableElectronicInvoicing(Boolean(initialData.enable_electronic_invoicing));
        setSinBranchCode(
          initialData.sin_branch_code !== null && initialData.sin_branch_code !== undefined
            ? String(initialData.sin_branch_code)
            : ""
        );
        setSinPointOfSaleCode(
          initialData.sin_point_of_sale_code !== null && initialData.sin_point_of_sale_code !== undefined
            ? String(initialData.sin_point_of_sale_code)
            : ""
        );
      } else {
        setName("");
        setAddress("");
        setPhone("");
        setIsActive(true);
        setLocation("");
        setImagePreview(null);
        setImagePayload(null);
        setEnableCustomers(false);
        setEnablePayment(false);
        setEnableObservations(false);
        setEnableDiscount(false);
        setEnableElectronicInvoicing(false);
        setSinBranchCode("");
        setSinPointOfSaleCode("");
      }
      setActiveTab("info");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen, initialData]);

  // Handle image upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen de fachada no debe superar los 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setImagePayload(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImagePayload("delete");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("El nombre de la tienda es obligatorio");
      setActiveTab("info");
      return;
    }
    if (!address.trim()) {
      toast.error("La dirección física es obligatoria");
      setActiveTab("info");
      return;
    }
    if (!phone.trim()) {
      toast.error("El teléfono de contacto es obligatorio");
      setActiveTab("info");
      return;
    }

    const parsedBranchCode =
      sinBranchCode.trim() !== "" ? parseInt(sinBranchCode.trim(), 10) : null;
    const parsedPosCode =
      sinPointOfSaleCode.trim() !== "" ? parseInt(sinPointOfSaleCode.trim(), 10) : null;

    const payload: Record<string, any> = {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      is_active: isActive,
      location: location ? location.trim() : null,
      enable_customers: enableCustomers,
      enable_payment: enablePayment,
      enable_observations: enableObservations,
      enable_discount: enableDiscount,
      enable_electronic_invoicing: enableElectronicInvoicing,
      sin_branch_code: parsedBranchCode,
      sin_point_of_sale_code: parsedPosCode,
    };

    if (imagePayload !== null) {
      payload.front_image = imagePayload;
    }

    setIsSubmitting(true);
    try {
      const res = await onSubmit(payload);
      if (res !== false) {
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
      size="3xl"
      backdrop="blur"
      placement="center"
      scrollBehavior="inside"
      classNames={{
        base: "max-h-[90vh] bg-content1 rounded-xl shadow-xl overflow-hidden my-auto",
      }}
    >
      <ModalContent>
        {(closeModal) => (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <ModalHeader className="py-2 px-3 flex flex-col gap-1.5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <LuStore size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                    {isEditing
                      ? `Editar Tienda: ${initialData?.name || ""}`
                      : "Registrar Nueva Tienda o Sucursal"}
                  </h3>
                  <p className="text-[11px] text-default-500 font-normal truncate">
                    Configuración de sucursal física, coordenadas satelitales y módulos POS.
                  </p>
                </div>
              </div>

              {/* Tabs Navigation */}
              <Tabs
                aria-label="Pestañas de tienda"
                selectedKey={activeTab}
                onSelectionChange={(k) => setActiveTab(k as string)}
                variant="underlined"
                color="primary"
                size="sm"
                className="mt-0.5"
                classNames={{
                  tabList: "gap-2 overflow-x-auto max-w-full p-0 scrollbar-none",
                  cursor: "w-full bg-primary",
                  tab: "max-w-fit px-1.5 h-8 font-semibold text-xs",
                }}
              >
                <Tab
                  key="info"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuInfo size={14} />
                      <span>General</span>
                    </div>
                  }
                />
                <Tab
                  key="location"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuSatellite size={14} />
                      <span>Ubicación GPS</span>
                      {location ? (
                        <Chip size="sm" color="success" variant="flat" className="h-4 text-[9px] px-1">
                          Fijada
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="flat" className="h-4 text-[9px] text-default-400 px-1">
                          Opcional
                        </Chip>
                      )}
                    </div>
                  }
                />
                <Tab
                  key="pos"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuLayers size={14} />
                      <span>Módulos POS</span>
                      {(enableCustomers || enablePayment || enableObservations || enableDiscount) ? (
                        <Chip size="sm" color="primary" variant="flat" className="h-4 text-[9px] px-1">
                          Activo
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="flat" className="h-4 text-[9px] text-default-400 px-1">
                          Inactivo
                        </Chip>
                      )}
                    </div>
                  }
                />
                <Tab
                  key="billing"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuReceipt size={14} />
                      <span>Facturación</span>
                      {enableElectronicInvoicing ? (
                        <Chip size="sm" color="success" variant="flat" className="h-4 text-[9px] px-1">
                          Activo
                        </Chip>
                      ) : (
                        <Chip size="sm" variant="flat" className="h-4 text-[9px] text-default-400 px-1">
                          Inactivo
                        </Chip>
                      )}
                    </div>
                  }
                />
              </Tabs>
            </ModalHeader>

            <Divider />

            <ModalBody className="p-2 px-3 flex flex-col gap-2 overflow-y-auto">
              {/* TAB 1: General Info & Facade Image */}
              {activeTab === "info" && (
                <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      isRequired
                      size="sm"
                      label="Nombre de la Tienda"
                      placeholder="Ej: Sucursal Central Oruro"
                      labelPlacement="outside"
                      value={name}
                      onValueChange={setName}
                      startContent={<LuStore className="text-default-400" size={15} />}
                      variant="flat"
                      radius="lg"
                    />

                    <Input
                      isRequired
                      size="sm"
                      label="Teléfono / Celular de Contacto"
                      placeholder="Ej: +591 71234567"
                      labelPlacement="outside"
                      value={phone}
                      onValueChange={setPhone}
                      startContent={<LuPhone className="text-default-400" size={15} />}
                      variant="flat"
                      radius="lg"
                    />

                    <div className="sm:col-span-2">
                      <Input
                        isRequired
                        size="sm"
                        label="Dirección Física"
                        placeholder="Ej: Av. 6 de Agosto esquina Bolívar #1234"
                        labelPlacement="outside"
                        value={address}
                        onValueChange={setAddress}
                        startContent={<LuMapPin className="text-default-400" size={15} />}
                        variant="flat"
                        radius="lg"
                      />
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="p-2 rounded-xl bg-default-100/70 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-semibold text-foreground">
                        Habilitar Tienda para Ventas (POS)
                      </span>
                      <span className="text-[11px] text-default-500">
                        Permite al personal asignado operar la caja registradora en esta sucursal.
                      </span>
                    </div>
                    <Switch
                      isSelected={isActive}
                      onValueChange={setIsActive}
                      color="success"
                      size="sm"
                    />
                  </div>

                  {/* Facade Image Section */}
                  <div className="p-2 rounded-xl bg-default-100/70 flex flex-col sm:flex-row items-center gap-2">
                    <div className="w-20 h-16 sm:w-24 sm:h-20 rounded-lg bg-content2 overflow-hidden flex items-center justify-center shrink-0">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Vista previa fachada"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-default-400 gap-0.5">
                          <LuStore size={20} />
                          <span className="text-[9px]">Sin imagen</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center sm:items-start gap-1 flex-1 text-center sm:text-left min-w-0">
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">
                          Imagen de Fachada (Opcional)
                        </h4>
                        <p className="text-[11px] text-default-500 line-clamp-2">
                          Foto exterior de la tienda física para reconocimiento visual.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="flat"
                          color="primary"
                          startContent={<LuCamera size={14} />}
                          onPress={() => fileInputRef.current?.click()}
                          className="h-7 text-xs"
                        >
                          {imagePreview ? "Cambiar Imagen" : "Subir Fotografía"}
                        </Button>

                        {imagePreview && (
                          <Button
                            type="button"
                            size="sm"
                            variant="light"
                            color="danger"
                            startContent={<LuX size={14} />}
                            onPress={handleRemoveImage}
                            className="h-7 text-xs"
                          >
                            Quitar Imagen
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Satellite Map & GPS Location */}
              {activeTab === "location" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2 p-2 rounded-xl bg-primary-50/50 dark:bg-primary-950/30 text-xs text-default-700">
                    <LuSatellite className="text-primary shrink-0 mt-0.5" size={15} />
                    <p className="text-[11px]">
                      <strong>Geolocalización:</strong> Haz clic en el mapa satelital para ubicar el pin de la sucursal.
                    </p>
                  </div>

                  <SatelliteLocationPicker
                    value={location}
                    onChange={setLocation}
                    height="280px"
                  />
                </div>
              )}

              {/* TAB 3: Dynamic POS Sections */}
              {activeTab === "pos" && (
                <div className="flex flex-col gap-2">
                  <div className="p-2 rounded-xl bg-primary-50/50 dark:bg-primary-950/30 text-xs text-default-700 flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <LuLayers className="text-primary" size={14} /> Secciones Dinámicas en Carrito / POS
                    </span>
                    <p className="text-default-500 text-[11px]">
                      Habilita o deshabilita los bloques de cobro visibles para los vendedores en esta tienda.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2 rounded-xl bg-default-50/80 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">Selección de Cliente</span>
                        <span className="text-[11px] text-default-400">
                          Pestaña de cliente (rápido o registrado) en el carrito.
                        </span>
                      </div>
                      <Switch
                        size="sm"
                        isSelected={enableCustomers}
                        onValueChange={setEnableCustomers}
                        color="primary"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-default-50/80 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">Método de Pago</span>
                        <span className="text-[11px] text-default-400">
                          Efectivo, Tarjeta, QR y cálculo de cambio.
                        </span>
                      </div>
                      <Switch
                        size="sm"
                        isSelected={enablePayment}
                        onValueChange={setEnablePayment}
                        color="primary"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-default-50/80 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">Notas u Observaciones</span>
                        <span className="text-[11px] text-default-400">
                          Campo para notas y comentarios en la venta.
                        </span>
                      </div>
                      <Switch
                        size="sm"
                        isSelected={enableObservations}
                        onValueChange={setEnableObservations}
                        color="primary"
                      />
                    </div>

                    <div className="p-2 rounded-xl bg-default-50/80 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">Descuentos</span>
                        <span className="text-[11px] text-default-400">
                          Permite rebajas o descuentos monetarios al total.
                        </span>
                      </div>
                      <Switch
                        size="sm"
                        isSelected={enableDiscount}
                        onValueChange={setEnableDiscount}
                        color="primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Facturación Electrónica */}
              {activeTab === "billing" && (
                <div className="flex flex-col gap-2.5">
                  {!isTenantInvoicingEnabled && (
                    <div className="p-2.5 rounded-xl bg-warning-50/60 dark:bg-warning-950/20 border border-warning-200/60 dark:border-warning-900/40 flex items-start gap-2.5">
                      <LuAlertTriangle className="text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" size={16} />
                      <div className="flex flex-col gap-0.5 text-xs">
                        <span className="font-semibold text-warning-800 dark:text-warning-300">
                          Facturación electrónica desactivada en la empresa
                        </span>
                        <p className="text-warning-700 dark:text-warning-400 text-[11px] leading-relaxed">
                          La facturación electrónica debe habilitarse primero desde <strong>Configuración &gt; Facturación electrónica</strong> antes de poder activar sucursales o puntos de venta.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-default-100/70 flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-semibold text-foreground">
                        Habilitar Facturación en esta Tienda
                      </span>
                      <span className="text-[11px] text-default-500">
                        Permite emitir comprobantes fiscales desde esta sucursal física.
                      </span>
                    </div>
                    <Switch
                      isSelected={enableElectronicInvoicing && isTenantInvoicingEnabled}
                      isDisabled={!isTenantInvoicingEnabled}
                      onValueChange={(val) => {
                        if (!isTenantInvoicingEnabled) {
                          toast.warning("La facturación electrónica debe habilitarse primero desde Configuración > Facturación electrónica.");
                          return;
                        }
                        setEnableElectronicInvoicing(val);
                      }}
                      color="primary"
                      size="sm"
                    />
                  </div>

                  {enableElectronicInvoicing && isTenantInvoicingEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-default-50/80 border border-divider">
                      <Input
                        size="sm"
                        type="number"
                        min={0}
                        label="Código de Sucursal SIN"
                        placeholder="0"
                        labelPlacement="outside"
                        value={sinBranchCode}
                        onValueChange={setSinBranchCode}
                        variant="flat"
                        radius="lg"
                        description="0 = Casa Matriz / Sucursal Principal"
                      />

                      <Input
                        size="sm"
                        type="number"
                        min={0}
                        label="Código Punto de Venta SIN"
                        placeholder="0"
                        labelPlacement="outside"
                        value={sinPointOfSaleCode}
                        onValueChange={setSinPointOfSaleCode}
                        variant="flat"
                        radius="lg"
                        description="0 = Punto de Venta por defecto"
                      />
                    </div>
                  )}
                </div>
              )}
            </ModalBody>

            <Divider />

            <ModalFooter className="py-1.5 px-3 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                {activeTab === "info" ? (
                  <Button
                    type="button"
                    variant="light"
                    size="sm"

                    onPress={() => setActiveTab("location")}
                    className="text-xs text-primary font-medium h-7"
                  >
                    Fijar ubicación GPS &rarr;
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="light"
                    size="sm"
                    onPress={() => setActiveTab("info")}
                    className="text-xs text-default-500 font-medium h-7"
                  >
                    &larr; Volver a general
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="flat" onPress={closeModal} isDisabled={isSubmitting} className="h-8 text-xs">
                  Cerrar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  color="primary"
                  isLoading={isSubmitting}
                  className="font-semibold text-xs h-8 shadow-sm"
                >
                  {isEditing ? "Actualizar Tienda" : "Guardar Tienda"}
                </Button>
              </div>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
};
