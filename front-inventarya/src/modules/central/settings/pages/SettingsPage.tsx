import React, { useEffect, useState, useRef } from "react";
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Input,
  Textarea,
  Button,
  Switch,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  useDisclosure,
  Divider,
  Skeleton,
} from "@nextui-org/react";
import {
  LuSparkles,
  LuPhone,
  LuMail,
  LuFileText,
  LuHelpCircle,
  LuUpload,
  LuExternalLink,
  LuSave,
  LuPlus,
  LuPencil,
  LuTrash2,
  LuCheckCircle2,
  LuEye,
  LuRefreshCw,
  LuBuilding2,
  LuInfo,
} from "react-icons/lu";
import { toast } from "sonner";
import { useCentralSettingsStore } from "../store/settings.store";
import { IFaqItem } from "../interfaces/configuration.interface";
import { FaqModal } from "../components/FaqModal";
import { DeleteFaqModal } from "../components/DeleteFaqModal";
import { DynamicBreadcrumbs } from "@/components";

export const SettingsPage: React.FC = () => {
  const {
    configuration,
    faqs,
    isLoading,
    isSaving,
    isLoadingFaqs,
    getConfiguration,
    updateConfiguration,
    getFaqs,
    toggleFaqPublished,
  } = useCentralSettingsStore();

  const [selectedTab, setSelectedTab] = useState<string>("branding");

  // Local Form state for Configuration
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    phone: "",
    email: "",
    logo: "",
    favicon: "",
    privacy: "",
    terms: "",
    about_us: "",
  });

  // File uploads
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // FAQ modals state
  const { isOpen: isFaqOpen, onOpen: openFaq, onClose: closeFaq } = useDisclosure();
  const [selectedFaq, setSelectedFaq] = useState<IFaqItem | null>(null);

  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();
  const [faqToDelete, setFaqToDelete] = useState<IFaqItem | null>(null);

  // Load initial data
  useEffect(() => {
    getConfiguration();
    getFaqs();
  }, [getConfiguration, getFaqs]);

  // Sync configuration to local form state
  useEffect(() => {
    if (configuration) {
      setFormData({
        name: configuration.name || "",
        description: configuration.description || "",
        phone: configuration.phone || "",
        email: configuration.email || "",
        logo: configuration.logo || "",
        favicon: configuration.favicon || "",
        privacy: configuration.privacy || "",
        terms: configuration.terms || "",
        about_us: configuration.about_us || "",
      });
      setLogoPreview(configuration.logo || null);
      setFaviconPreview(configuration.favicon || null);
    }
  }, [configuration]);

  // Handlers for file selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("El archivo excede los 2MB permitidos");
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast.error("El favicon excede 1MB");
        return;
      }
      setFaviconFile(file);
      setFaviconPreview(URL.createObjectURL(file));
    }
  };

  // Submit configuration changes
  const handleSaveConfig = async () => {
    const data = new FormData();
    data.append("name", formData.name);
    data.append("description", formData.description);
    data.append("phone", formData.phone);
    data.append("email", formData.email);
    data.append("privacy", formData.privacy);
    data.append("terms", formData.terms);
    data.append("about_us", formData.about_us);

    if (logoFile) {
      data.append("logo_file", logoFile);
    } else if (formData.logo) {
      data.append("logo", formData.logo);
    }

    if (faviconFile) {
      data.append("favicon_file", faviconFile);
    } else if (formData.favicon) {
      data.append("favicon", formData.favicon);
    }

    const success = await updateConfiguration(data);
    if (success) {
      setLogoFile(null);
      setFaviconFile(null);
    }
  };

  const handleOpenWhatsAppTest = () => {
    const clean = formData.phone.replace(/[^0-9]/g, "");
    if (!clean) {
      toast.warning("Ingresa primero un número de teléfono válido.");
      return;
    }
    const testUrl = `https://wa.me/${clean}?text=${encodeURIComponent(
      `¡Hola! Mensaje de prueba desde la Configuración de ${formData.name || "Inventarya"}.`
    )}`;
    window.open(testUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col gap-6 pb-16 max-w-7xl mx-auto w-full">
      {/* Breadcrumb navigation */}
      <DynamicBreadcrumbs title="Configuración del Sistema" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-content1 p-6 rounded-2xl border border-divider shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">Configuración del Sistema</h1>
            <Chip size="sm" color="primary" variant="flat" className="font-semibold">
              SaaS Central
            </Chip>
          </div>
          <p className="text-default-500 text-sm mt-1">
            Administra la identidad de marca, canales de WhatsApp, términos legales y preguntas frecuentes de la Landing Page.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="flat"
            color="default"
            startContent={<LuExternalLink className="w-4 h-4" />}
            onPress={() => window.open("/landing", "_blank")}
          >
            Ver Landing Page
          </Button>
          <Button
            color="primary"
            className="font-semibold"
            startContent={<LuSave className="w-4 h-4" />}
            isLoading={isSaving}
            onPress={handleSaveConfig}
          >
            Guardar Cambios
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/4 rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        </Card>
      ) : (
        /* Tabs navigation */
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={(k) => setSelectedTab(k as string)}
          variant="underlined"
          color="primary"
          aria-label="Opciones de Configuración"
          classNames={{
            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
            cursor: "w-full bg-primary",
            tab: "max-w-fit px-2 h-12 text-sm font-semibold",
          }}
        >
          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 1: BRANDING & IDENTIDAD */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Tab
            key="branding"
            title={
              <div className="flex items-center gap-2">
                <LuSparkles className="w-4 h-4 text-primary" />
                <span>Identidad & Branding</span>
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
              {/* Main Info Form */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border border-divider shadow-sm">
                  <CardHeader className="p-6 pb-2 flex flex-col items-start gap-1">
                    <h3 className="text-base font-bold">Datos de la Plataforma</h3>
                    <p className="text-xs text-default-400">
                      Información principal visible en el navbar, banners y metadata del sitio.
                    </p>
                  </CardHeader>
                  <CardBody className="p-6 pt-4 space-y-4">
                    <Input
                      label="Nombre de la Plataforma / Software"
                      placeholder="Ej. Inventarya"
                      value={formData.name}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, name: val }))}
                      variant="bordered"
                      isRequired
                      description="Aparece en el navbar, pie de página y títulos del sistema."
                    />

                    <Textarea
                      label="Descripción General / Eslogan"
                      placeholder="Ej. Sistema Cloud de Control de Inventarios, Almacenes Múltiples y POS en Tiempo Real."
                      value={formData.description}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, description: val }))}
                      variant="bordered"
                      minRows={3}
                      description="Texto explicativo principal para el Hero de la Landing Page."
                    />
                  </CardBody>
                </Card>

                {/* File Uploads Card */}
                <Card className="border border-divider shadow-sm">
                  <CardHeader className="p-6 pb-2 flex flex-col items-start gap-1">
                    <h3 className="text-base font-bold">Archivos de Imagen (Logo & Favicon)</h3>
                    <p className="text-xs text-default-400">
                      Sube los archivos visuales o ingresa URLs de almacenamiento CDN.
                    </p>
                  </CardHeader>
                  <CardBody className="p-6 pt-4 space-y-6">
                    {/* Logo Section */}
                    <div>
                      <label className="text-sm font-semibold block mb-2">Logotipo Principal</label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-24 h-16 rounded-xl border border-dashed border-default-300 bg-default-50 flex items-center justify-center overflow-hidden shrink-0">
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="max-h-full max-w-full object-contain p-1" />
                          ) : (
                            <span className="text-[11px] text-default-400 text-center px-1">Sin Logo</span>
                          )}
                        </div>
                        <div className="space-y-2 flex-1 w-full">
                          <div className="flex gap-2">
                            <input
                              type="file"
                              ref={logoInputRef}
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={handleLogoChange}
                            />
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              startContent={<LuUpload className="w-3.5 h-3.5" />}
                              onPress={() => logoInputRef.current?.click()}
                            >
                              Subir Archivo
                            </Button>
                            {logoPreview && (
                              <Button
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() => {
                                  setLogoFile(null);
                                  setLogoPreview(null);
                                  setFormData((prev) => ({ ...prev, logo: "" }));
                                }}
                              >
                                Quitar
                              </Button>
                            )}
                          </div>
                          <Input
                            size="sm"
                            placeholder="O pega la URL del logo: https://..."
                            value={formData.logo}
                            onValueChange={(val) => {
                              setFormData((prev) => ({ ...prev, logo: val }));
                              setLogoPreview(val || null);
                            }}
                            variant="bordered"
                          />
                        </div>
                      </div>
                    </div>

                    <Divider />

                    {/* Favicon Section */}
                    <div>
                      <label className="text-sm font-semibold block mb-2">Favicon del Navegador (32x32 / .ico / .png)</label>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-14 h-14 rounded-xl border border-dashed border-default-300 bg-default-50 flex items-center justify-center overflow-hidden shrink-0">
                          {faviconPreview ? (
                            <img src={faviconPreview} alt="Favicon" className="w-8 h-8 object-contain" />
                          ) : (
                            <span className="text-[10px] text-default-400 text-center">Icono</span>
                          )}
                        </div>
                        <div className="space-y-2 flex-1 w-full">
                          <div className="flex gap-2">
                            <input
                              type="file"
                              ref={faviconInputRef}
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              onChange={handleFaviconChange}
                            />
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              startContent={<LuUpload className="w-3.5 h-3.5" />}
                              onPress={() => faviconInputRef.current?.click()}
                            >
                              Subir Favicon
                            </Button>
                            {faviconPreview && (
                              <Button
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() => {
                                  setFaviconFile(null);
                                  setFaviconPreview(null);
                                  setFormData((prev) => ({ ...prev, favicon: "" }));
                                }}
                              >
                                Quitar
                              </Button>
                            )}
                          </div>
                          <Input
                            size="sm"
                            placeholder="O pega la URL del favicon: https://..."
                            value={formData.favicon}
                            onValueChange={(val) => {
                              setFormData((prev) => ({ ...prev, favicon: val }));
                              setFaviconPreview(val || null);
                            }}
                            variant="bordered"
                          />
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Live Preview Card */}
              <div className="space-y-4">
                <Card className="border border-divider shadow-sm bg-gradient-to-b from-default-50 to-content1">
                  <CardHeader className="p-4 pb-2">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <LuEye className="w-4 h-4 text-primary" />
                      <span>Vista Previa en Vivo</span>
                    </h4>
                  </CardHeader>
                  <CardBody className="p-4 space-y-4">
                    <p className="text-xs text-default-400">
                      Así se muestra la cabecera de la Landing Page con tu branding configurado:
                    </p>
                    <div className="p-4 rounded-xl bg-slate-950 text-white border border-slate-800 shadow-inner">
                      <div className="flex items-center gap-3">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo Preview" className="h-8 w-auto object-contain rounded" />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow">
                            {formData.name.charAt(0) || "S"}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-black tracking-tight">{formData.name || "Inventarya"}</p>
                          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">
                            Inventarios & POS
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-400 line-clamp-2">
                        {formData.description || "El Sistema de Inventarios y Punto de Venta definitivo."}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>
          </Tab>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 2: CONTACTO & WHATSAPP */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Tab
            key="contact"
            title={
              <div className="flex items-center gap-2">
                <LuPhone className="w-4 h-4 text-emerald-500" />
                <span>Contacto & WhatsApp</span>
              </div>
            }
          >
            <div className="max-w-3xl space-y-6 mt-4">
              <Card className="border border-divider shadow-sm">
                <CardHeader className="p-6 pb-2 flex flex-col items-start gap-1">
                  <h3 className="text-base font-bold">Canales de Atención al Cliente</h3>
                  <p className="text-xs text-default-400">
                    Este número de teléfono es el destino directo de los botones de WhatsApp de la Landing Page.
                  </p>
                </CardHeader>
                <CardBody className="p-6 pt-4 space-y-6">
                  <div>
                    <Input
                      label="Teléfono WhatsApp para Ventas y Asesoramiento"
                      placeholder="Ej. +591 78901234"
                      value={formData.phone}
                      onValueChange={(val) => setFormData((prev) => ({ ...prev, phone: val }))}
                      variant="bordered"
                      startContent={<LuPhone className="text-emerald-500" />}
                      description="Incluye el código de país (ej. +591 para Bolivia). Los visitantes que seleccionen un plan escribirán automáticamente a este número."
                    />

                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        color="success"
                        startContent={<LuPhone className="w-3.5 h-3.5" />}
                        onPress={handleOpenWhatsAppTest}
                      >
                        Probar Enlace WhatsApp con este Número
                      </Button>
                    </div>
                  </div>

                  <Divider />

                  <Input
                    label="Correo Electrónico de Contacto Oficial"
                    placeholder="Ej. ventas@inventarya.com"
                    value={formData.email}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, email: val }))}
                    variant="bordered"
                    startContent={<LuMail className="text-primary" />}
                    description="Mostrado en el pie de página para consultas corporativas."
                  />
                </CardBody>
              </Card>

              {/* Informative Card */}
              <Card className="border border-emerald-500/30 bg-emerald-500/5">
                <CardBody className="p-4 flex flex-row items-start gap-3">
                  <LuInfo className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-default-600 space-y-1">
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Sincronización Automática con la Landing Page:
                    </p>
                    <p>
                      Cuando un cliente hace clic en <strong>"Contactar por WhatsApp"</strong> en cualquiera de los planes (Starter, Business o Enterprise), el sistema envía un mensaje predefinido con el nombre del plan, el precio y los límites directo a este número.
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>
          </Tab>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 3: POLITICAS LEGALES & NOSOTROS */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Tab
            key="legal"
            title={
              <div className="flex items-center gap-2">
                <LuFileText className="w-4 h-4 text-violet-500" />
                <span>Políticas Legales & Nosotros</span>
              </div>
            }
          >
            <div className="max-w-4xl space-y-6 mt-4">
              <Card className="border border-divider shadow-sm">
                <CardHeader className="p-6 pb-2 flex flex-col items-start gap-1">
                  <h3 className="text-base font-bold">Acerca de Nosotros (About Us)</h3>
                  <p className="text-xs text-default-400">
                    Describe la empresa, la misión y el valor de la plataforma de inventarios.
                  </p>
                </CardHeader>
                <CardBody className="p-6 pt-2">
                  <Textarea
                    placeholder="Escribe sobre la historia y misión del software..."
                    value={formData.about_us}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, about_us: val }))}
                    variant="bordered"
                    minRows={4}
                  />
                </CardBody>
              </Card>

              <Card className="border border-divider shadow-sm">
                <CardHeader className="p-6 pb-2 flex flex-col items-start gap-1">
                  <h3 className="text-base font-bold">Política de Privacidad</h3>
                  <p className="text-xs text-default-400">
                    Texto legal sobre la protección de datos y el tratamiento seguro de las bases de datos de cada cliente.
                  </p>
                </CardHeader>
                <CardBody className="p-6 pt-2">
                  <Textarea
                    placeholder="Detalla las cláusulas de privacidad y confidencialidad..."
                    value={formData.privacy}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, privacy: val }))}
                    variant="bordered"
                    minRows={5}
                  />
                </CardBody>
              </Card>

              <Card className="border border-divider shadow-sm">
                <CardHeader className="p-6 pb-2 flex flex-col items-start gap-1">
                  <h3 className="text-base font-bold">Términos y Condiciones del Servicio</h3>
                  <p className="text-xs text-default-400">
                    Condiciones de suscripción, límites de uso y garantías de disponibilidad del servicio SaaS.
                  </p>
                </CardHeader>
                <CardBody className="p-6 pt-2">
                  <Textarea
                    placeholder="Detalla los términos de servicio..."
                    value={formData.terms}
                    onValueChange={(val) => setFormData((prev) => ({ ...prev, terms: val }))}
                    variant="bordered"
                    minRows={5}
                  />
                </CardBody>
              </Card>
            </div>
          </Tab>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* TAB 4: PREGUNTAS FRECUENTES (FAQS) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <Tab
            key="faqs"
            title={
              <div className="flex items-center gap-2">
                <LuHelpCircle className="w-4 h-4 text-amber-500" />
                <span>Preguntas Frecuentes ({faqs.length})</span>
              </div>
            }
          >
            <div className="space-y-6 mt-4">
              {/* FAQ Actions Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-content1 p-4 rounded-xl border border-divider">
                <div>
                  <h3 className="text-base font-bold">Gestión de FAQs de la Landing Page</h3>
                  <p className="text-xs text-default-400">
                    Crea, edita y ordena las preguntas que se mostrarán en la sección interactiva de preguntas frecuentes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<LuRefreshCw className="w-3.5 h-3.5" />}
                    isLoading={isLoadingFaqs}
                    onPress={() => getFaqs()}
                  >
                    Recargar
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    startContent={<LuPlus className="w-4 h-4" />}
                    onPress={() => {
                      setSelectedFaq(null);
                      openFaq();
                    }}
                  >
                    Nueva Pregunta
                  </Button>
                </div>
              </div>

              {/* FAQs Table */}
              <Card className="border border-divider shadow-sm">
                <Table aria-label="Tabla de Preguntas Frecuentes">
                  <TableHeader>
                    <TableColumn>PREGUNTA</TableColumn>
                    <TableColumn>CATEGORÍA</TableColumn>
                    <TableColumn className="text-center">ORDEN</TableColumn>
                    <TableColumn className="text-center">ESTADO</TableColumn>
                    <TableColumn className="text-right">ACCIONES</TableColumn>
                  </TableHeader>
                  <TableBody
                    isLoading={isLoadingFaqs}
                    emptyContent="No hay preguntas frecuentes registradas."
                  >
                    {faqs.map((faq) => (
                      <TableRow key={faq.id}>
                        <TableCell>
                          <div className="max-w-md">
                            <p className="font-semibold text-sm line-clamp-1">{faq.question}</p>
                            <p className="text-xs text-default-400 line-clamp-1 mt-0.5">{faq.answer}</p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Chip size="sm" variant="flat" color="default" className="text-xs">
                            {faq.category}
                          </Chip>
                        </TableCell>

                        <TableCell className="text-center">
                          <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-default-100">
                            {faq.sort_order}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <Tooltip content={faq.is_published ? "Visible en la landing" : "Oculta"}>
                            <div className="flex justify-center">
                              <Switch
                                size="sm"
                                isSelected={faq.is_published}
                                onValueChange={() => toggleFaqPublished(faq)}
                                color="success"
                              />
                            </div>
                          </Tooltip>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip content="Editar">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => {
                                  setSelectedFaq(faq);
                                  openFaq();
                                }}
                              >
                                <LuPencil className="w-4 h-4 text-default-600" />
                              </Button>
                            </Tooltip>
                            <Tooltip content="Eliminar" color="danger">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() => {
                                  setFaqToDelete(faq);
                                  openDelete();
                                }}
                              >
                                <LuTrash2 className="w-4 h-4 text-danger" />
                              </Button>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </Tab>
        </Tabs>
      )}

      {/* Floating Save Button Bar on Bottom */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-content1/90 backdrop-blur-md border border-divider shadow-2xl px-6 py-3 rounded-full flex items-center gap-4">
        <span className="text-xs text-default-500 font-medium hidden sm:inline">
          {isSaving ? "Guardando cambios en el servidor..." : "Configuraciones listas para sincronizar"}
        </span>
        <Button
          color="primary"
          size="sm"
          className="font-bold px-5"
          startContent={<LuSave className="w-4 h-4" />}
          isLoading={isSaving}
          onPress={handleSaveConfig}
        >
          Guardar Todo
        </Button>
      </div>

      {/* Modal for Creating/Editing FAQ */}
      <FaqModal isOpen={isFaqOpen} onClose={closeFaq} faq={selectedFaq} />

      {/* Modal for Deleting FAQ */}
      <DeleteFaqModal isOpen={isDeleteOpen} onClose={closeDelete} faq={faqToDelete} />
    </div>
  );
};
