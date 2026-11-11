import React, { useEffect, useState, useRef } from "react";
import {
  Button,
  Input,
  Textarea,
  Tabs,
  Tab,
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  Divider,
  Chip,
} from "@nextui-org/react";
import { useForm } from "react-hook-form";
import { useSettingStore } from "../../store/settings/settings.store";
import { IListSettings } from "../../interfaces/settings/list-response";
import { IUpdateSettingPayload } from "../../interfaces/settings/update-settings-request";
import { INVENTARYA_LOGO_PATH } from "@/components/branding/AppLogo";
import { DynamicBreadcrumbs } from "@/components";
import {
  LuBuilding,
  LuMail,
  LuPhone,
  LuMapPin,
  LuDollarSign,
  LuPalette,
  LuShare2,
  LuFileText,
  LuUpload,
  LuTrash2,
  LuSave,
  LuSliders,
  LuUserCheck,
  LuTruck,
  LuCheck,
  LuUserX,
  LuShieldAlert,
  LuReceipt,
  LuKey,
  LuHash,
  LuShieldCheck,
  LuLock,
  LuInfo,
  LuRefreshCw,
} from "react-icons/lu";
import { PRESET_PRIMARY_COLORS, applyPrimaryColorTheme, DEFAULT_PRIMARY_COLOR } from "@/utils/themeColor";
import { FaFacebook, FaInstagram, FaTiktok, FaWhatsapp } from "react-icons/fa6";
import { AccountDeletionModal } from "../../components/AccountDeletionModal";
import { SiatOnboardingStepper } from "../../components/SiatOnboardingStepper";
import { SIAT_ENVIRONMENTS, SIAT_MODALITIES } from "../../constants/siat.constants";

export const SettingsPage = () => {
  const { setting, getSettings, updateSettings, isLoading, isSaving } = useSettingStore();

  const [selectedTab, setSelectedTab] = useState("branding");
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false);
  const [isReplacingToken, setIsReplacingToken] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [isReplacingPassword, setIsReplacingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Logo & Favicon File handling
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string>("");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Partial<IUpdateSettingPayload>>({
    mode: "onChange",
  });

  const currentColor = watch("primary_color") || "#3b82f6";
  const currentTheme = watch("theme") || "light";

  // Load initial settings
  useEffect(() => {
    getSettings();
  }, [getSettings]);

  // Sync form with loaded settings
  useEffect(() => {
    if (setting) {
      reset({
        business_name: setting.business_name || setting.name || "",
        email: setting.email || "",
        phone: setting.phone || "",
        address: setting.address || "",
        currency: setting.currency,
        timezone: setting.timezone,
        theme: setting.theme || "light",
        primary_color: setting.primary_color || "#3b82f6",
        terms: setting.terms || "",
        policy: setting.policy || "",
        enable_customers: Boolean(setting.enable_customers),
        enable_suppliers: Boolean(setting.enable_suppliers),
        enable_locations: Boolean(setting.enable_locations),
        electronic_invoicing_enabled: Boolean(setting.electronic_invoicing_enabled),
        tax_nit: setting.tax_nit || "",
        tax_business_name: setting.tax_business_name || "",
        siat_environment: setting.siat_environment ?? 2,
        siat_modality: setting.siat_modality ?? 1,
        siat_system_code: setting.siat_system_code || "",
        social: {
          whatsapp: setting.social?.whatsapp || "",
          facebook: setting.social?.facebook || "",
          instagram: setting.social?.instagram || "",
          tiktok: setting.social?.tiktok || "",
        },
      });
      setIsReplacingToken(false);
      setNewToken("");
      setIsReplacingPassword(false);
      setNewPassword("");

      setLogoPreview(setting.logo || INVENTARYA_LOGO_PATH);
      setFaviconPreview(setting.favicon || "/favicon.ico");
      applyPrimaryColorTheme(setting.primary_color || DEFAULT_PRIMARY_COLOR);
    }
  }, [setting, reset]);

  // Handle Logo Upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const preview = URL.createObjectURL(file);
      setLogoPreview(preview);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(INVENTARYA_LOGO_PATH);
    setValue("logo", INVENTARYA_LOGO_PATH, { shouldDirty: true });
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  // Handle Favicon Upload
  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFaviconFile(file);
      const preview = URL.createObjectURL(file);
      setFaviconPreview(preview);
    }
  };

  const handleRemoveFavicon = () => {
    setFaviconFile(null);
    setFaviconPreview("/favicon.ico");
    setValue("favicon", "/favicon.ico", { shouldDirty: true });
    if (faviconInputRef.current) faviconInputRef.current.value = "";
  };

  const onSubmit = async (data: Partial<IUpdateSettingPayload>) => {
    const formData = new FormData();

    formData.append("business_name", data.business_name || "");
    if (data.email) formData.append("email", data.email);
    if (data.phone) formData.append("phone", data.phone);
    if (data.address) formData.append("address", data.address);
    if (data.currency) formData.append("currency", data.currency);
    if (data.timezone) formData.append("timezone", data.timezone);
    if (data.theme) formData.append("theme", data.theme);
    if (data.primary_color) formData.append("primary_color", data.primary_color);
    if (data.terms) formData.append("terms", data.terms);
    if (data.policy) formData.append("policy", data.policy);

    formData.append("enable_customers", data.enable_customers ? "1" : "0");
    formData.append("enable_suppliers", data.enable_suppliers ? "1" : "0");
    formData.append("enable_locations", data.enable_locations ? "1" : "0");

    // Facturación electrónica (SIAT / SIN)
    formData.append("electronic_invoicing_enabled", data.electronic_invoicing_enabled ? "1" : "0");
    if (data.tax_nit !== undefined) formData.append("tax_nit", data.tax_nit || "");
    if (data.tax_business_name !== undefined) formData.append("tax_business_name", data.tax_business_name || "");
    if (data.siat_environment !== undefined) formData.append("siat_environment", String(data.siat_environment));
    if (data.siat_modality !== undefined) formData.append("siat_modality", String(data.siat_modality));
    if (data.siat_system_code !== undefined) formData.append("siat_system_code", data.siat_system_code || "");

    // Secretos SIAT: Únicamente enviar cuando el usuario explícitamente ingresó un NUEVO valor no vacío
    if (isReplacingToken && newToken.trim()) {
      formData.append("siat_api_token", newToken.trim());
    } else if (!setting?.siat_token_configured && newToken.trim()) {
      formData.append("siat_api_token", newToken.trim());
    }

    if (isReplacingPassword && newPassword.trim()) {
      formData.append("siat_certificate_password", newPassword.trim());
    } else if (!setting?.siat_certificate_password_configured && newPassword.trim()) {
      formData.append("siat_certificate_password", newPassword.trim());
    }

    // Social links as JSON
    const socialData = {
      whatsapp: data.social?.whatsapp || "",
      facebook: data.social?.facebook || "",
      instagram: data.social?.instagram || "",
      tiktok: data.social?.tiktok || "",
    };
    formData.append("social", JSON.stringify(socialData));

    // Logo
    if (logoFile) {
      formData.append("logo_file", logoFile);
    } else if (logoPreview) {
      formData.append("logo", logoPreview);
    }

    // Favicon
    if (faviconFile) {
      formData.append("favicon_file", faviconFile);
    } else if (faviconPreview) {
      formData.append("favicon", faviconPreview);
    }

    const success = await updateSettings(formData);
    if (success) {
      setLogoFile(null);
      setFaviconFile(null);
      setIsReplacingToken(false);
      setNewToken("");
      setIsReplacingPassword(false);
      setNewPassword("");
    }
  };

  if (isLoading && !setting) {
    return (
      <div className="my-1 px-2 max-w-6xl mx-auto w-full flex flex-col gap-2 pb-6">
        <Skeleton className="h-5 w-40 rounded-lg" />
        <Skeleton className="h-6 w-60 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="my-1 px-2 max-w-6xl mx-auto w-full flex flex-col gap-2 pb-6 animate-in fade-in duration-300">
      {/* Top Header with Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <DynamicBreadcrumbs title="Configuración del Sistema" />
          <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-1.5 mt-0.5">
            <LuSliders className="text-primary" size={18} />
            Configuración del Sistema
          </h1>
        </div>
      </div>
      <Divider className="my-0.5" />

      {/* Main Settings Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-2">
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
          color="primary"
          variant="underlined"
          classNames={{
            base: "w-full overflow-x-auto lg:overflow-x-visible",
            tabList:
              "w-max min-w-full lg:w-auto lg:min-w-0 overflow-x-auto lg:overflow-x-visible gap-1 sm:gap-2 py-0.5 scrollbar-none",
            cursor: "w-full bg-primary",
            tab: "shrink-0 lg:shrink-initial max-w-fit px-2 sm:px-2.5 h-8 text-xs font-semibold whitespace-nowrap",
          }}
        >
          {/* TAB 1: Identidad & Branding */}
          <Tab
            key="branding"
            title={
              <div className="flex items-center gap-1.5">
                <LuPalette size={15} />
                <span>Identidad & Marca</span>
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 pt-1">
              {/* Left col: Logo & Favicon Card */}
              <Card className="shadow-none rounded-xl bg-content1 overflow-hidden lg:col-span-1">
                <CardHeader className="p-2 pb-1 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-foreground">Recursos Visuales</span>
                  <span className="text-[11px] text-default-400">Logotipo y favicon para el sistema</span>
                </CardHeader>
                <Divider />
                <CardBody className="p-2 flex flex-col gap-2">
                  {/* Logo Area */}
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-default-100/70">
                    <span className="text-[11px] font-bold text-default-600 self-start">Logotipo Oficial</span>
                    <div className="w-20 h-20 rounded-xl bg-background p-1.5 flex items-center justify-center overflow-hidden">
                      <img
                        src={logoPreview || INVENTARYA_LOGO_PATH}
                        alt="Logo Preview"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = INVENTARYA_LOGO_PATH;
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="h-7 text-xs px-2.5"
                        startContent={<LuUpload size={13} />}
                        onPress={() => logoInputRef.current?.click()}
                      >
                        Cambiar
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        className="h-7 text-xs px-2"
                        startContent={<LuTrash2 size={13} />}
                        onPress={handleRemoveLogo}
                      >
                        Quitar
                      </Button>
                    </div>
                    <span className="text-[10px] text-default-400 text-center">
                      PNG, JPG, SVG o WebP (Max 2MB)
                    </span>
                  </div>

                  {/* Favicon Area */}
                  <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-default-100/70">
                    <span className="text-[11px] font-bold text-default-600 self-start">Favicon del Navegador</span>
                    <div className="w-12 h-12 rounded-lg bg-background p-1 flex items-center justify-center overflow-hidden">
                      <img
                        src={faviconPreview || "/favicon.ico"}
                        alt="Favicon Preview"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/favicon.ico";
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={faviconInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        className="hidden"
                        onChange={handleFaviconChange}
                      />
                      <Button
                        size="sm"
                        variant="flat"
                        color="default"
                        className="h-7 text-xs px-2.5"
                        startContent={<LuUpload size={13} />}
                        onPress={() => faviconInputRef.current?.click()}
                      >
                        Subir
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        color="danger"
                        className="h-7 text-xs px-2"
                        startContent={<LuTrash2 size={13} />}
                        onPress={handleRemoveFavicon}
                      >
                        Quitar
                      </Button>
                    </div>
                    <span className="text-[10px] text-default-400 text-center">
                      Icono .ico o PNG (Max 1MB)
                    </span>
                  </div>
                </CardBody>
              </Card>

              {/* Right col: Business Name & Style */}
              <Card className="shadow-none rounded-xl bg-content1 overflow-hidden lg:col-span-2">
                <CardHeader className="p-2 pb-1 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-foreground">Nombre & Apariencia</span>
                  <span className="text-[11px] text-default-400">Datos públicos y estilo de tu empresa</span>
                </CardHeader>
                <Divider />
                <CardBody className="p-2 flex flex-col gap-2">
                  <Input
                    isRequired
                    size="sm"
                    label="Nombre Comercial / Razón Social"
                    placeholder="Ej: Ferretería Central SRL"
                    labelPlacement="outside"
                    startContent={<LuBuilding size={15} className="text-default-400" />}
                    {...register("business_name", { required: "El nombre es obligatorio" })}
                    isInvalid={!!errors.business_name}
                    errorMessage={errors.business_name?.message}
                    description="Se mostrará en facturas, comprobantes, POS y la barra de navegación."
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      size="sm"
                      label="Tema Predeterminado"
                      labelPlacement="outside"
                      selectedKeys={[currentTheme]}
                      onChange={(e) => setValue("theme", e.target.value as "light" | "dark", { shouldDirty: true })}
                      description="Tema visual inicial para los trabajadores de la tienda."
                    >
                      <SelectItem key="light" value="light">Claro (Light Mode)</SelectItem>
                      <SelectItem key="dark" value="dark">Oscuro (Dark Mode)</SelectItem>
                    </Select>

                    {/* Color de Marca y Tema Dinámico con 7 Colores Predefinidos */}
                    <div className="flex flex-col gap-2.5 sm:col-span-2 pt-2 border-t border-default-100">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                          <LuPalette className="text-primary text-xs" />
                          <span>Color de Marca del Proyecto (Tema Dinámico)</span>
                        </label>
                        <span className="text-[10px] text-default-400 font-mono font-semibold">
                          {currentColor}
                        </span>
                      </div>
                      <p className="text-[11px] text-default-400 -mt-1">
                        Elige uno de los 7 colores predefinidos o define un código personalizado. Los botones, acentos, chips y componentes visuales cambiarán dinámicamente en todo el sistema.
                      </p>

                      {/* 7 Colores Predefinidos */}
                      <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 pt-0.5">
                        {PRESET_PRIMARY_COLORS.map((color) => {
                          const isSelected = currentColor.toLowerCase() === color.hex.toLowerCase();
                          return (
                            <button
                              key={color.id}
                              type="button"
                              onClick={() => {
                                setValue("primary_color", color.hex, { shouldDirty: true });
                                applyPrimaryColorTheme(color.hex);
                              }}
                              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-center group cursor-pointer ${
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30"
                                  : "border-default-200 hover:border-default-400 bg-content2/40 hover:bg-content2/80"
                              }`}
                              title={`${color.name}: ${color.description}`}
                            >
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center shadow-xs transition-transform group-hover:scale-105"
                                style={{ backgroundColor: color.hex }}
                              >
                                {isSelected && (
                                  <LuCheck className="text-white text-xs drop-shadow-xs" strokeWidth={3} />
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-foreground leading-tight truncate w-full">
                                {color.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Selector Personalizado */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-2 p-1 pl-2 rounded-lg border border-default-200 bg-content2/30">
                          <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => {
                              setValue("primary_color", e.target.value, { shouldDirty: true });
                              applyPrimaryColorTheme(e.target.value);
                            }}
                            className="w-7 h-7 rounded-md cursor-pointer border-0 p-0 bg-transparent"
                            title="Selector libre de color"
                          />
                          <span className="text-xs text-default-500 font-medium">Personalizado:</span>
                        </div>
                        <Input
                          size="sm"
                          value={currentColor}
                          onChange={(e) => {
                            setValue("primary_color", e.target.value, { shouldDirty: true });
                            applyPrimaryColorTheme(e.target.value);
                          }}
                          placeholder="#3b82f6"
                          className="max-w-[140px]"
                        />
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Tab>

          {/* TAB 2: Contacto & Ubicación */}
          <Tab
            key="contact"
            title={
              <div className="flex items-center gap-1.5">
                <LuMapPin size={15} />
                <span>Contacto & Ubicación</span>
              </div>
            }
          >
            <div className="pt-1 max-w-3xl">
              <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
                <CardHeader className="p-2 pb-1 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-foreground">Canales de Contacto</span>
                  <span className="text-[11px] text-default-400">Medios de comunicación para clientes y comprobantes</span>
                </CardHeader>
                <Divider />
                <CardBody className="p-2 flex flex-col gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      size="sm"
                      label="Correo Electrónico de Contacto"
                      type="email"
                      placeholder="ventas@miempresa.com"
                      labelPlacement="outside"
                      startContent={<LuMail size={15} className="text-default-400" />}
                      {...register("email", {
                        pattern: { value: /^\S+@\S+$/i, message: "Correo inválido" },
                      })}
                      isInvalid={!!errors.email}
                      errorMessage={errors.email?.message}
                      description="Correo mostrado en recibos y atención."
                    />

                    <Input
                      size="sm"
                      label="Teléfono / Celular de Contacto"
                      type="tel"
                      placeholder="+591 70012345"
                      labelPlacement="outside"
                      startContent={<LuPhone size={15} className="text-default-400" />}
                      {...register("phone")}
                      description="Línea telefónica para atención al público."
                    />
                  </div>

                  <Textarea
                    size="sm"
                    label="Dirección Física de la Sucursal Central"
                    placeholder="Av. Principal #123, Zona Central"
                    labelPlacement="outside"
                    minRows={2}
                    startContent={<LuMapPin size={15} className="text-default-400 mt-1" />}
                    {...register("address")}
                    description="Dirección impresa en encabezados de notas de venta y recibos."
                  />
                </CardBody>
              </Card>
            </div>
          </Tab>

          {/* TAB 3: Moneda & Regional */}
          <Tab
            key="regional"
            title={
              <div className="flex items-center gap-1.5">
                <LuDollarSign size={15} />
                <span>Moneda & Regional</span>
              </div>
            }
          >
            <div className="pt-1 max-w-3xl">
              <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
                <CardHeader className="p-2 pb-1 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-foreground">Moneda y Zona Horaria</span>
                  <span className="text-[11px] text-default-400">Reglas financieras y sincronización de horarios</span>
                </CardHeader>
                <Divider />
                <CardBody className="p-2 flex flex-col gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      isRequired
                      size="sm"
                      label="Moneda Principal de Venta"
                      labelPlacement="outside"
                      selectedKeys={[watch("currency") || "BOB"]}
                      onChange={(e) => setValue("currency", e.target.value, { shouldDirty: true })}
                      description="Símbolo y código monetario para los precios."
                    >
                      <SelectItem key="BOB" value="BOB">BOB - Boliviano (Bs.) 🇧🇴</SelectItem>
                      <SelectItem key="USD" value="USD">USD - Dólar Estadounidense ($) 🇺🇸</SelectItem>
                      <SelectItem key="EUR" value="EUR">EUR - Euro (€) 🇪🇺</SelectItem>
                      <SelectItem key="PEN" value="PEN">PEN - Sol Peruano (S/.) 🇵🇪</SelectItem>
                      <SelectItem key="ARS" value="ARS">ARS - Peso Argentino ($) 🇦🇷</SelectItem>
                      <SelectItem key="CLP" value="CLP">CLP - Peso Chileno ($) 🇨🇱</SelectItem>
                      <SelectItem key="COP" value="COP">COP - Peso Colombiano ($) 🇨🇴</SelectItem>
                      <SelectItem key="MXN" value="MXN">MXN - Peso Mexicano ($) 🇲🇽</SelectItem>
                    </Select>

                    <Select
                      isRequired
                      size="sm"
                      label="Zona Horaria (Timezone)"
                      labelPlacement="outside"
                      selectedKeys={[watch("timezone") || "America/La_Paz"]}
                      onChange={(e) => setValue("timezone", e.target.value, { shouldDirty: true })}
                      description="Garantiza precisión en la fecha y hora de cada venta."
                    >
                      <SelectItem key="America/La_Paz" value="America/La_Paz">Bolivia (GMT-4 - La Paz)</SelectItem>
                      <SelectItem key="America/Lima" value="America/Lima">Perú (GMT-5 - Lima)</SelectItem>
                      <SelectItem key="America/Santiago" value="America/Santiago">Chile (GMT-3 - Santiago)</SelectItem>
                      <SelectItem key="America/Bogota" value="America/Bogota">Colombia (GMT-5 - Bogotá)</SelectItem>
                      <SelectItem key="America/Argentina/Buenos_Aires" value="America/Argentina/Buenos_Aires">Argentina (GMT-3 - Buenos Aires)</SelectItem>
                      <SelectItem key="America/Mexico_City" value="America/Mexico_City">México (GMT-6 - Ciudad de México)</SelectItem>
                      <SelectItem key="America/New_York" value="America/New_York">EE.UU. (GMT-5 - New York)</SelectItem>
                      <SelectItem key="Europe/Madrid" value="Europe/Madrid">España (GMT+1 - Madrid)</SelectItem>
                    </Select>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Tab>

          {/* TAB 4: Redes Sociales */}
          <Tab
            key="social"
            title={
              <div className="flex items-center gap-1.5">
                <LuShare2 size={15} />
                <span>Redes Sociales</span>
              </div>
            }
          >
            <div className="pt-1 max-w-3xl">
              <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
                <CardHeader className="p-2 pb-1 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-foreground">Enlaces Sociales</span>
                  <span className="text-[11px] text-default-400">Canales digitales para fidelizar a tus clientes</span>
                </CardHeader>
                <Divider />
                <CardBody className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    size="sm"
                    label="WhatsApp de Pedidos"
                    placeholder="https://wa.me/59170012345 o número"
                    labelPlacement="outside"
                    startContent={<FaWhatsapp size={15} className="text-success" />}
                    {...register("social.whatsapp")}
                  />

                  <Input
                    size="sm"
                    label="Página de Facebook"
                    placeholder="https://facebook.com/miempresa"
                    labelPlacement="outside"
                    startContent={<FaFacebook size={15} className="text-blue-600" />}
                    {...register("social.facebook")}
                  />

                  <Input
                    size="sm"
                    label="Perfil de Instagram"
                    placeholder="https://instagram.com/miempresa"
                    labelPlacement="outside"
                    startContent={<FaInstagram size={15} className="text-pink-600" />}
                    {...register("social.instagram")}
                  />

                  <Input
                    size="sm"
                    label="Canal de TikTok"
                    placeholder="https://tiktok.com/@miempresa"
                    labelPlacement="outside"
                    startContent={<FaTiktok size={15} className="text-foreground" />}
                    {...register("social.tiktok")}
                  />
                </CardBody>
              </Card>
            </div>
          </Tab>

          {/* TAB 5: Políticas y Términos */}
          <Tab
            key="legal"
            title={
              <div className="flex items-center gap-1.5">
                <LuFileText size={15} />
                <span>Términos & Políticas</span>
              </div>
            }
          >
            <div className="pt-1 max-w-3xl flex flex-col gap-2">
              <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
                <CardHeader className="p-2 pb-1 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-foreground">Términos y Condiciones</span>
                  <span className="text-[11px] text-default-400">Condiciones de compra, cambios y devoluciones</span>
                </CardHeader>
                <Divider />
                <CardBody className="p-2">
                  <Textarea
                    size="sm"
                    placeholder="Describe los términos comerciales, políticas de devolución y garantía de los productos..."
                    minRows={4}
                    {...register("terms")}
                  />
                </CardBody>
              </Card>

              <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
                <CardHeader className="p-2 pb-1 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-foreground">Políticas de Privacidad</span>
                  <span className="text-[11px] text-default-400">Tratamiento de datos y privacidad de clientes</span>
                </CardHeader>
                <Divider />
                <CardBody className="p-2">
                  <Textarea
                    size="sm"
                    placeholder="Detalla cómo tu empresa protege los datos personales de los clientes..."
                    minRows={4}
                    {...register("policy")}
                  />
                </CardBody>
              </Card>
            </div>
          </Tab>

          {/* TAB 6: Módulos & Secciones Dinámicas */}
          <Tab
            key="modules"
            title={
              <div className="flex items-center gap-1.5">
                <LuSliders size={15} />
                <span>Módulos & Secciones</span>
              </div>
            }
          >
            <div className="pt-1 max-w-3xl flex flex-col gap-2">
              <Card className="shadow-none rounded-xl bg-content1 overflow-hidden">
                <CardHeader className="p-2 pb-1 flex flex-col items-start gap-0.5">
                  <span className="text-xs font-bold text-foreground">Módulos del Sistema</span>
                  <span className="text-[11px] text-default-400">
                    Habilita o deshabilita secciones dinámicas del panel lateral según las operaciones de tu empresa. Por defecto están todas deshabilitadas.
                  </span>
                </CardHeader>
                <Divider />
                <CardBody className="p-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-default-100/70">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <LuUserCheck size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">Módulo de Clientes</span>
                        <span className="text-[11px] text-default-500">Muestra la sección de Clientes en el menú y permite registrar clientes detallados.</span>
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      isSelected={Boolean(watch("enable_customers"))}
                      onValueChange={(val) => setValue("enable_customers", val, { shouldDirty: true })}
                      color="primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-default-100/70">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <LuTruck size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">Módulo de Proveedores</span>
                        <span className="text-[11px] text-default-500">Muestra la sección de Proveedores en el menú para gestionar contactos de compras.</span>
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      isSelected={Boolean(watch("enable_suppliers"))}
                      onValueChange={(val) => setValue("enable_suppliers", val, { shouldDirty: true })}
                      color="primary"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-default-100/70">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <LuMapPin size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-foreground">Módulo de Ubicaciones</span>
                        <span className="text-[11px] text-default-500">Muestra la sección de Ubicaciones para organizar pasillos, estantes y bodegas.</span>
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      isSelected={Boolean(watch("enable_locations"))}
                      onValueChange={(val) => setValue("enable_locations", val, { shouldDirty: true })}
                      color="primary"
                    />
                  </div>
                </CardBody>
              </Card>
            </div>
          </Tab>

          {/* TAB 7: Facturación Electrónica (SIAT / SIN) */}
          <Tab
            key="electronic_invoicing"
            title={
              <div className="flex items-center gap-1.5">
                <LuReceipt size={15} />
                <span>Facturación Electrónica</span>
                <Chip
                  size="sm"
                  variant="flat"
                  color={
                    setting?.electronic_invoicing_status === "configured"
                      ? "success"
                      : setting?.electronic_invoicing_status === "incomplete"
                      ? "warning"
                      : "default"
                  }
                  className="h-4 text-[9px] px-1 font-semibold"
                >
                  {setting?.electronic_invoicing_status === "configured"
                    ? "Configurado"
                    : setting?.electronic_invoicing_status === "incomplete"
                    ? "Incompleto"
                    : "Desactivado"}
                </Chip>
              </div>
            }
          >
            <div className="pt-1 max-w-3xl flex flex-col gap-3">
              {/* Tarjeta de Interruptor Maestro */}
              <Card className="shadow-none rounded-xl bg-content1 border border-default-200/60 dark:border-default-100/20 overflow-hidden">
                <CardHeader className="p-3 pb-1 flex flex-col items-start gap-0.5">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <LuReceipt size={16} />
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-foreground block">
                          Facturación Electrónica (SIAT / SIN)
                        </span>
                        <span className="text-[11px] text-default-400">
                          Habilita la configuración fiscal del negocio para emisión electrónica de facturas.
                        </span>
                      </div>
                    </div>
                    <Switch
                      size="sm"
                      isSelected={Boolean(watch("electronic_invoicing_enabled"))}
                      onValueChange={(val) =>
                        setValue("electronic_invoicing_enabled", val, { shouldDirty: true })
                      }
                      color="primary"
                    />
                  </div>
                </CardHeader>
                <Divider />
                <CardBody className="p-3">
                  <div className="flex items-center gap-2 text-[11px] p-2 rounded-xl bg-default-100/60 text-default-600">
                    <LuInfo size={16} className="text-primary shrink-0" />
                    <span>
                      <strong>Fase 1: Configuración Local.</strong> Esta sección almacena tus datos fiscales y credenciales delegadas. La conexión SOAP/REST con el SIN, CUIS, CUFD y emisión de facturas se habilitarán en las siguientes fases.
                    </span>
                  </div>
                </CardBody>
              </Card>

              {/* Si está habilitada, mostrar las tarjetas de configuración */}
              {watch("electronic_invoicing_enabled") ? (
                <>
                  <SiatOnboardingStepper setting={setting} />

                  {/* Card 1: Datos Fiscales del Emisor */}
                  <Card className="shadow-none rounded-xl bg-content1 border border-default-200/60 dark:border-default-100/20 overflow-hidden">
                    <CardHeader className="p-3 pb-1 flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-2 text-foreground font-bold text-xs sm:text-sm">
                        <LuBuilding className="text-primary" size={16} />
                        <span>Datos Fiscales del Emisor</span>
                      </div>
                      <span className="text-[11px] text-default-400">
                        Identificación tributaria registrada en el Padrón Nacional de Contribuyentes (SIN)
                      </span>
                    </CardHeader>
                    <Divider />
                    <CardBody className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        isRequired
                        size="sm"
                        label="NIT del Emisor"
                        placeholder="Ej: 1020304050"
                        labelPlacement="outside"
                        startContent={<LuHash size={15} className="text-default-400" />}
                        {...register("tax_nit", {
                          maxLength: { value: 30, message: "Máximo 30 caracteres" },
                        })}
                        description="Número de Identificación Tributaria registrado ante el SIN."
                      />

                      <Input
                        isRequired
                        size="sm"
                        label="Razón Social Fiscal (Registrada en SIN)"
                        placeholder="Ej: JUAN CARLOS PÉREZ MAMANI o EMPRESA S.R.L."
                        labelPlacement="outside"
                        startContent={<LuBuilding size={15} className="text-default-400" />}
                        {...register("tax_business_name", {
                          maxLength: { value: 200, message: "Máximo 200 caracteres" },
                        })}
                        description="Nombre fiscal oficial. Para el nombre comercial del sistema utilice 'Identidad & Marca'."
                      />
                    </CardBody>
                  </Card>

                  {/* Card 2: Configuración del Sistema SIAT */}
                  <Card className="shadow-none rounded-xl bg-content1 border border-default-200/60 dark:border-default-100/20 overflow-hidden">
                    <CardHeader className="p-3 pb-1 flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-2 text-foreground font-bold text-xs sm:text-sm">
                        <LuSliders className="text-primary" size={16} />
                        <span>Parámetros de Integración SIAT</span>
                      </div>
                      <span className="text-[11px] text-default-400">
                        Ambiente y modalidad autorizados por el Servicio de Impuestos Nacionales
                      </span>
                    </CardHeader>
                    <Divider />
                    <CardBody className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select
                        isRequired
                        size="sm"
                        label="Ambiente SIAT"
                        labelPlacement="outside"
                        selectedKeys={[String(watch("siat_environment") ?? 2)]}
                        onChange={(e) =>
                          setValue("siat_environment", Number(e.target.value), { shouldDirty: true })
                        }
                        description="Selecciona 'Pruebas / Piloto' durante el periodo de pruebas."
                      >
                        {SIAT_ENVIRONMENTS.map((env) => (
                          <SelectItem key={env.key} value={env.key} textValue={env.label}>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold">{env.label}</span>
                              <span className="text-[10px] text-default-400">{env.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </Select>

                      <Select
                        isRequired
                        size="sm"
                        label="Modalidad de Facturación"
                        labelPlacement="outside"
                        selectedKeys={[String(watch("siat_modality") ?? 1)]}
                        onChange={(e) =>
                          setValue("siat_modality", Number(e.target.value), { shouldDirty: true })
                        }
                        description="Modalidad otorgada por el SIN a tu sistema."
                      >
                        {SIAT_MODALITIES.map((mod) => (
                          <SelectItem key={mod.key} value={mod.key} textValue={mod.label}>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold">{mod.label}</span>
                              <span className="text-[10px] text-default-400">{mod.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </Select>

                      <div className="sm:col-span-2">
                        <Input
                          isRequired
                          size="sm"
                          label="Código de Sistema (SIAT)"
                          placeholder="Ej: ABC123XYZ456"
                          labelPlacement="outside"
                          startContent={<LuKey size={15} className="text-default-400" />}
                          {...register("siat_system_code", {
                            maxLength: { value: 100, message: "Máximo 100 caracteres" },
                          })}
                          description="Código asignado por el SIN al registrar el sistema informático de facturación."
                        />
                      </div>
                    </CardBody>
                  </Card>

                  {/* Card 3: Credenciales Delegadas & Seguridad */}
                  <Card className="shadow-none rounded-xl bg-content1 border border-default-200/60 dark:border-default-100/20 overflow-hidden">
                    <CardHeader className="p-3 pb-1 flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-2 text-foreground font-bold text-xs sm:text-sm">
                        <LuLock className="text-primary" size={16} />
                        <span>Credenciales Delegadas & Certificado</span>
                      </div>
                      <span className="text-[11px] text-default-400">
                        Almacenamiento cifrado en base de datos. Los secretos nunca se exponen al navegador.
                      </span>
                    </CardHeader>
                    <Divider />
                    <CardBody className="p-3 flex flex-col gap-3">
                      {/* Token SIAT */}
                      <div className="p-2.5 rounded-xl bg-default-100/70 border border-default-200/60 dark:border-default-100/20 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LuShieldCheck
                              size={18}
                              className={
                                setting?.siat_token_configured ? "text-success" : "text-default-400"
                              }
                            />
                            <div>
                              <span className="text-xs font-bold text-foreground block">
                                Token Delegado SIAT
                              </span>
                              <span className="text-[11px] text-default-400">
                                {setting?.siat_token_configured
                                  ? "Configurado y almacenado bajo cifrado AES-256."
                                  : "Aún no has configurado el token delegado."}
                              </span>
                            </div>
                          </div>

                          {setting?.siat_token_configured && (
                            <Button
                              size="sm"
                              variant="flat"
                              color={isReplacingToken ? "danger" : "primary"}
                              onPress={() => {
                                setIsReplacingToken(!isReplacingToken);
                                setNewToken("");
                              }}
                              startContent={<LuRefreshCw size={13} />}
                              className="text-xs h-7 font-semibold"
                            >
                              {isReplacingToken ? "Cancelar Reemplazo" : "Reemplazar Token"}
                            </Button>
                          )}
                        </div>

                        {(!setting?.siat_token_configured || isReplacingToken) && (
                          <div className="mt-1 pt-2 border-t border-default-200/50 flex flex-col gap-1.5 animate-in fade-in duration-200">
                            <span className="text-xs font-semibold text-foreground">
                              {setting?.siat_token_configured
                                ? "Ingresa el nuevo Token Delegado para reemplazar el actual:"
                                : "Ingresa el Token Delegado provisto por el SIN:"}
                            </span>
                            <Textarea
                              size="sm"
                              placeholder="Pega aquí el token SIAT otorgado..."
                              minRows={3}
                              value={newToken}
                              onValueChange={setNewToken}
                              description="Al guardar, el token se cifrará de inmediato y se mantendrá protegido."
                            />
                          </div>
                        )}
                      </div>

                      {/* Contraseña del Certificado */}
                      <div className="p-2.5 rounded-xl bg-default-100/70 border border-default-200/60 dark:border-default-100/20 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LuKey
                              size={18}
                              className={
                                setting?.siat_certificate_password_configured
                                  ? "text-success"
                                  : "text-default-400"
                              }
                            />
                            <div>
                              <span className="text-xs font-bold text-foreground block">
                                Contraseña del Certificado
                              </span>
                              <span className="text-[11px] text-default-400">
                                {setting?.siat_certificate_password_configured
                                  ? "Configurada y protegida con cifrado seguro."
                                  : "No configurada."}
                              </span>
                            </div>
                          </div>

                          {setting?.siat_certificate_password_configured && (
                            <Button
                              size="sm"
                              variant="flat"
                              color={isReplacingPassword ? "danger" : "primary"}
                              onPress={() => {
                                setIsReplacingPassword(!isReplacingPassword);
                                setNewPassword("");
                              }}
                              startContent={<LuRefreshCw size={13} />}
                              className="text-xs h-7 font-semibold"
                            >
                              {isReplacingPassword ? "Cancelar" : "Cambiar Contraseña"}
                            </Button>
                          )}
                        </div>

                        {(!setting?.siat_certificate_password_configured || isReplacingPassword) && (
                          <div className="mt-1 pt-2 border-t border-default-200/50 flex flex-col gap-1.5 animate-in fade-in duration-200">
                            <span className="text-xs font-semibold text-foreground">
                              {setting?.siat_certificate_password_configured
                                ? "Ingresa la nueva contraseña para reemplazar la anterior:"
                                : "Ingresa la contraseña del certificado digital:"}
                            </span>
                            <Input
                              size="sm"
                              type="password"
                              placeholder="••••••••"
                              value={newPassword}
                              onValueChange={setNewPassword}
                              description="Al guardar, la contraseña se cifrará de inmediato y se mantendrá protegida."
                            />
                          </div>
                        )}
                      </div>

                      {/* Certificado Digital */}
                      <div className="p-2.5 rounded-xl bg-default-100/70 border border-default-200/60 dark:border-default-100/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LuLock size={18} className="text-default-400" />
                          <div>
                            <span className="text-xs font-bold text-foreground block">
                              Certificado Digital (.p12 / .pfx)
                            </span>
                            <span className="text-[11px] text-default-400">
                              {setting?.siat_certificate_path
                                ? "Certificado cargado."
                                : "No configurado (se gestionará en la fase de firma digital)."}
                            </span>
                          </div>
                        </div>
                        <Chip size="sm" variant="flat" color="default" className="text-[10px]">
                          Fase 1: Preparado
                        </Chip>
                      </div>
                    </CardBody>
                  </Card>
                </>
              ) : (
                <Card className="shadow-none rounded-xl bg-content1 border border-default-200/60 dark:border-default-100/20 p-6 text-center">
                  <div className="flex flex-col items-center gap-2 max-w-md mx-auto">
                    <div className="w-12 h-12 rounded-2xl bg-default-100 text-default-400 flex items-center justify-center">
                      <LuReceipt size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">
                      Facturación Electrónica Desactivada
                    </h3>
                    <p className="text-xs text-default-500">
                      Inventarya funciona actualmente con notas de venta y recibos de inventario estándar. Para comenzar a preparar los parámetros fiscales del SIN, activa el interruptor superior.
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </Tab>

          {/* TAB 8: Cuenta & Privacidad (Google Play Compliance) */}
          <Tab
            key="account"
            title={
              <div className="flex items-center gap-1.5 text-danger-500">
                <LuUserX size={15} />
                <span>Cuenta & Privacidad</span>
              </div>
            }
          >
            <div className="pt-1 max-w-3xl flex flex-col gap-3">
              <Card className="shadow-none rounded-xl bg-content1 border border-divider overflow-hidden">
                <CardHeader className="p-3 pb-1 flex flex-col items-start gap-0.5">
                  <div className="flex items-center gap-2 text-danger font-bold text-xs sm:text-sm">
                    <LuShieldAlert size={18} />
                    <span>Eliminación de Cuenta y Retención de Datos</span>
                  </div>
                  <span className="text-[11px] text-default-400">
                    Mecanismo oficial de privacidad y baja conforme a las políticas de Google Play
                  </span>
                </CardHeader>
                <Divider />
                <CardBody className="p-3 flex flex-col gap-3 text-xs text-default-600">
                  <p className="leading-relaxed">
                    Puede solicitar la eliminación de su cuenta y la anonimización de sus datos personales.
                    Por motivos de seguridad, se enviará un enlace de verificación criptográfico a su correo registrado con validez de 48 horas.
                  </p>

                  <div className="p-3 rounded-xl bg-default-100/80 border border-divider space-y-1.5">
                    <span className="font-bold text-foreground block">Políticas de retención y roles:</span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      <li>
                        <strong>Empleados y Colaboradores:</strong> Las credenciales, sesiones y tokens de dispositivos móviles (Android FCM) se eliminan al instante. La empresa y el resto del equipo continúan operando normalmente.
                      </li>
                      <li>
                        <strong>Propietarios:</strong> La solicitud requiere validación y coordinación con Soporte Técnico para transferir la titularidad o formalizar el respaldo y cierre de la empresa sin desproteger los datos del negocio.
                      </li>
                      <li>
                        <strong>Comprobantes fiscales y kardex:</strong> Se conservan por un periodo legal de 5 a 10 años conforme a la normativa tributaria comercial aplicable, desvinculados de sus credenciales personales.
                      </li>
                    </ul>
                  </div>

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      color="danger"
                      variant="flat"
                      size="sm"
                      className="font-bold"
                      startContent={<LuUserX size={16} />}
                      onPress={() => setIsDeletionModalOpen(true)}
                    >
                      Solicitar eliminación de cuenta
                    </Button>

                    <Button
                      as="a"
                      href="/delete-account"
                      target="_blank"
                      variant="light"
                      size="sm"
                      className="text-xs text-default-500"
                    >
                      Ver página pública de eliminación
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Tab>
        </Tabs>

        {/* Floating / Bottom Save Bar */}
        <Divider className="my-1" />
        <div className="flex justify-end items-center">
          <Button
            color="primary"
            size="sm"
            type="submit"
            className="h-8 text-xs font-bold px-4"
            startContent={<LuSave size={15} />}
            isLoading={isSaving}
            isDisabled={isSaving}
          >
            Guardar Configuración
          </Button>
        </div>
      </form>

      <AccountDeletionModal
        isOpen={isDeletionModalOpen}
        onClose={() => setIsDeletionModalOpen(false)}
      />
    </div>
  );
};
