import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  Input,
  Tooltip,
  Chip,
  Card,
  CardBody,
  Divider,
} from "@nextui-org/react";
import {
  LuKey,
  LuShieldCheck,
  LuShieldAlert,
  LuCopy,
  LuCheck,
  LuRefreshCw,
  LuCode,
  LuExternalLink,
  LuInfo,
  LuAlertTriangle,
  LuStore,
} from "react-icons/lu";
import { toast } from "sonner";
import { IShopResponse } from "@/modules/tenant/pos/interfaces/shops/shop-response";
import { useShopsStore } from "@/modules/tenant/pos/store/shops/shops.store";

interface StoreApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: IShopResponse | null;
}

export const StoreApiConfigModal: React.FC<StoreApiConfigModalProps> = ({
  isOpen,
  onClose,
  store,
}) => {
  const { getStoreApiCredentials, generateStoreApiCredentials, toggleStoreApiStatus } =
    useShopsStore();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  const [apiStatus, setApiStatus] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [hasSecret, setHasSecret] = useState<boolean>(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedSecret, setCopiedSecret] = useState<boolean>(false);
  const [copiedCurl, setCopiedCurl] = useState<boolean>(false);
  const [copiedJs, setCopiedJs] = useState<boolean>(false);

  const [confirmRegenerate, setConfirmRegenerate] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"curl" | "fetch">("curl");

  // Cargar las credenciales al abrir
  useEffect(() => {
    if (isOpen && store?.id) {
      setNewSecret(null);
      setConfirmRegenerate(false);
      setIsLoading(true);

      getStoreApiCredentials(store.id)
        .then((data) => {
          if (data) {
            setApiStatus(Boolean(data.api_status));
            setApiKey(data.api_key || null);
            setHasSecret(Boolean(data.has_api_secret));
          } else {
            setApiStatus(Boolean(store.api_status));
            setApiKey(store.api_key || null);
            setHasSecret(Boolean(store.has_api_secret));
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, store?.id]);

  // Manejar cambio en el Switch
  const handleToggleStatus = async (isSelected: boolean) => {
    if (!store?.id) return;
    if (isSelected && !apiKey) {
      toast.warning("Debes generar credenciales de API antes de habilitar el servicio.");
      return;
    }

    setIsToggling(true);
    const success = await toggleStoreApiStatus(store.id, isSelected);
    setIsToggling(false);

    if (success) {
      setApiStatus(isSelected);
    }
  };

  // Manejar generación de credenciales
  const handleGenerateCredentials = async () => {
    if (!store?.id) return;

    setIsGenerating(true);
    const result = await generateStoreApiCredentials(store.id);
    setIsGenerating(false);

    if (result) {
      setApiKey(result.api_key);
      setNewSecret(result.api_secret);
      setHasSecret(true);
      setApiStatus(true);
      setConfirmRegenerate(false);
    }
  };

  const copyToClipboard = (text: string, type: "key" | "secret" | "curl" | "js") => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === "secret") {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else if (type === "curl") {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else if (type === "js") {
      setCopiedJs(true);
      setTimeout(() => setCopiedJs(false), 2000);
    }
    toast.success("Copiado al portapapeles");
  };

  // URL base de la API externa
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // En local Vite corre en 5173 y backend en 8000
  const apiBaseUrl = import.meta.env.DEV
    ? (origin.includes(":5173")
      ? origin.replace(":5173", ":8000") + "/api/external/store-products"
      : origin + "/api/external/store-products")
    : `${import.meta.env.VITE_API_URL}/external/store-products`;

  const curlExample = `curl -X GET "${apiBaseUrl}" \\
  -H "X-API-KEY: ${apiKey || "pk_TU_PUBLIC_KEY"}" \\
  -H "X-API-SECRET: ${newSecret || "sk_TU_SECRET_KEY"}" \\
  -H "Accept: application/json"`;

  const fetchExample = `// Ejemplo en JavaScript / TypeScript (Node.js o Frontend)
const response = await fetch("${apiBaseUrl}", {
  method: "GET",
  headers: {
    "X-API-KEY": "${apiKey || "pk_TU_PUBLIC_KEY"}",
    "X-API-SECRET": "${newSecret || "sk_TU_SECRET_KEY"}",
    "Accept": "application/json"
  }
});

const data = await response.json();
console.log("Productos sincronizados:", data.data);`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      backdrop="blur"
      placement="center"
      scrollBehavior="inside"
      classNames={{
        base: "bg-content1 rounded-xl shadow-xl max-h-[90vh] overflow-hidden my-auto",
      }}
    >
      <ModalContent>
        {() => (
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            {/* Header con Badge de Estado */}
            <ModalHeader className="py-2 px-3 flex flex-col gap-1 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <LuKey size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                      API Externa de Productos
                    </h3>
                    <p className="text-[11px] text-default-500 flex items-center gap-1 font-normal truncate">
                      <LuStore size={12} className="text-default-400 shrink-0" />
                      Tienda: <strong className="text-foreground">{store?.name}</strong>
                    </p>
                  </div>
                </div>

                <Chip
                  size="sm"
                  color={apiStatus ? "success" : "default"}
                  variant="flat"
                  className="font-semibold text-[10px] capitalize h-5 px-1.5 shrink-0"
                  startContent={
                    apiStatus ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-success inline-block ml-0.5 animate-pulse" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-default-400 inline-block ml-0.5" />
                    )
                  }
                >
                  {apiStatus ? "Activo" : "Inactivo"}
                </Chip>
              </div>
            </ModalHeader>

            <Divider />

            <ModalBody className="p-2 px-3 flex flex-col gap-2 overflow-y-auto">
              {/* Card 1: Interruptor Principal */}
              <div className="p-2 rounded-xl bg-default-100/70 flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {apiStatus ? (
                      <LuShieldCheck className="text-success shrink-0" size={16} />
                    ) : (
                      <LuShieldAlert className="text-default-400 shrink-0" size={16} />
                    )}
                    Conexión Externa de Catálogo
                  </span>
                  <span className="text-[11px] text-default-500">
                    {apiStatus
                      ? "Tu sitio web externo puede consultar el catálogo de productos de esta tienda en tiempo real."
                      : "Cualquier petición externa recibirá un error 403 Forbidden bloqueando el acceso."}
                  </span>
                </div>

                <Switch
                  isSelected={apiStatus}
                  onValueChange={handleToggleStatus}
                  isDisabled={isToggling || !apiKey}
                  color="success"
                  size="sm"
                  aria-label="Alternar estado de la API"
                />
              </div>

              {/* Card 2: Credenciales de Conexión */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-default-600">
                      Credenciales de Seguridad
                    </h4>
                    <p className="text-[11px] text-default-400">
                      Cabeceras HTTP requeridas para autenticación de peticiones.
                    </p>
                  </div>

                  {apiKey && !confirmRegenerate && (
                    <Button
                      size="sm"
                      variant="flat"
                      color="warning"
                      startContent={<LuRefreshCw size={13} />}
                      className="text-xs font-semibold h-7"
                      onPress={() => setConfirmRegenerate(true)}
                    >
                      Regenerar llaves
                    </Button>
                  )}
                </div>

                {/* Confirmación si va a regenerar */}
                {confirmRegenerate && (
                  <div className="p-2 rounded-xl bg-warning-50/80 dark:bg-warning-950/30 flex flex-col gap-2">
                    <div className="flex items-start gap-2 text-warning-800 dark:text-warning-300">
                      <LuAlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <strong className="block font-bold">¿Deseas regenerar las credenciales?</strong>
                        Las llaves anteriores quedarán invalidadas de inmediato y tu sitio externo
                        dejará de responder hasta que actualices las claves.
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="flat"
                        className="text-xs h-7"
                        onPress={() => setConfirmRegenerate(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        color="warning"
                        variant="solid"
                        isLoading={isGenerating}
                        className="text-xs font-bold h-7"
                        onPress={handleGenerateCredentials}
                      >
                        Sí, Regenerar Ahora
                      </Button>
                    </div>
                  </div>
                )}

                {/* Si no tiene credenciales aún */}
                {!apiKey && !isGenerating && (
                  <div className="p-3 rounded-xl bg-default-100/50 text-center flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <LuKey size={20} />
                    </div>
                    <div className="max-w-md">
                      <p className="text-xs sm:text-sm font-bold text-foreground">Sin credenciales para esta tienda</p>
                      <p className="text-[11px] text-default-500 mt-0.5">
                        Genera llaves (Public Key y Secret Key) para permitir que tu tienda virtual o app
                        externa consuma los productos de forma segura.
                      </p>
                    </div>
                    <Button
                      color="primary"
                      size="sm"
                      className="font-bold text-xs shadow-sm h-8"
                      startContent={<LuKey size={14} />}
                      isLoading={isGenerating}
                      onPress={handleGenerateCredentials}
                    >
                      Generar Credenciales API
                    </Button>
                  </div>
                )}

                {/* Si tiene credenciales */}
                {apiKey && (
                  <div className="flex flex-col gap-2">
                    {/* Public Key */}
                    <div>
                      <label className="text-xs font-semibold text-default-700 block mb-0.5">
                        Identificador Público (X-API-KEY)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          readOnly
                          value={apiKey}
                          size="sm"
                          radius="lg"
                          variant="flat"
                          className="font-mono text-xs"
                        />
                        <Tooltip content={copiedKey ? "¡Copiado!" : "Copiar clave pública"}>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            color={copiedKey ? "success" : "default"}
                            className="shrink-0 h-8 w-8 min-w-8"
                            onPress={() => copyToClipboard(apiKey, "key")}
                          >
                            {copiedKey ? <LuCheck size={14} className="text-success" /> : <LuCopy size={14} />}
                          </Button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* ALERTA DE NUEVO SECRET RECIÉN GENERADO */}
                    {newSecret && (
                      <div className="p-2 rounded-xl bg-amber-500/10 flex flex-col gap-1.5">
                        <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                          <LuShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <strong className="block text-xs font-bold uppercase tracking-wider">
                              ¡Guarda tu Secret Key ahora!
                            </strong>
                            <p className="text-[11px] text-default-600 dark:text-default-400">
                              Por motivos de seguridad, esta clave se almacena encriptada y <strong>NUNCA</strong> se
                              volverá a mostrar.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Input
                            readOnly
                            value={newSecret}
                            size="sm"
                            radius="lg"
                            variant="faded"
                            color="warning"
                            className="font-mono text-xs font-bold"
                          />
                          <Button
                            size="sm"
                            color="warning"
                            variant="solid"
                            className="font-bold text-xs shrink-0 h-8"
                            startContent={copiedSecret ? <LuCheck size={14} /> : <LuCopy size={14} />}
                            onPress={() => copyToClipboard(newSecret, "secret")}
                          >
                            {copiedSecret ? "Copiado" : "Copiar Secret"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Secret Key cuando está oculto/almacenado */}
                    {!newSecret && hasSecret && (
                      <div>
                        <label className="text-xs font-semibold text-default-700 block mb-0.5">
                          Clave Secreta (X-API-SECRET)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            readOnly
                            value="sk_••••••••••••••••••••••••••••••••••••••••••••••••"
                            size="sm"
                            radius="lg"
                            variant="flat"
                            className="font-mono text-xs text-default-400"
                          />
                          <Tooltip content="Por seguridad, el secreto está cifrado en la base de datos y no es legible. Si lo perdiste, presiona Regenerar.">
                            <div className="p-1 text-default-400 cursor-help">
                              <LuInfo size={16} />
                            </div>
                          </Tooltip>
                        </div>
                        <span className="text-[10px] text-default-400 mt-0.5 block">
                          El secreto está protegido con cifrado Hash seguro.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Divider className="my-0.5" />

              {/* Card 3: Documentación Rápida de Consumo */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-default-600 flex items-center gap-1.5 truncate">
                    <LuCode size={14} className="text-primary shrink-0" />
                    Guía de Consumo de Productos
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant={activeTab === "curl" ? "solid" : "flat"}
                      color={activeTab === "curl" ? "primary" : "default"}
                      className="text-xs font-semibold h-6 px-2"
                      onPress={() => setActiveTab("curl")}
                    >
                      cURL
                    </Button>
                    <Button
                      size="sm"
                      variant={activeTab === "fetch" ? "solid" : "flat"}
                      color={activeTab === "fetch" ? "primary" : "default"}
                      className="text-xs font-semibold h-6 px-2"
                      onPress={() => setActiveTab("fetch")}
                    >
                      JS fetch
                    </Button>
                  </div>
                </div>

                <div className="relative rounded-xl bg-default-900 text-default-100 p-2.5 font-mono text-[11px] overflow-x-auto shadow-inner">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    className="absolute top-2 right-2 h-6 w-6 min-w-6 bg-white/10 hover:bg-white/20 text-white"
                    onPress={() =>
                      copyToClipboard(activeTab === "curl" ? curlExample : fetchExample, activeTab === "curl" ? "curl" : "js")
                    }
                  >
                    {(activeTab === "curl" ? copiedCurl : copiedJs) ? (
                      <LuCheck size={12} className="text-emerald-400" />
                    ) : (
                      <LuCopy size={12} />
                    )}
                  </Button>

                  <pre className="pr-7 whitespace-pre-wrap">
                    {activeTab === "curl" ? curlExample : fetchExample}
                  </pre>
                </div>

                <div className="text-[11px] text-default-500 leading-relaxed bg-default-100/60 p-2 rounded-xl">
                  <strong className="text-foreground">Datos devueltos:</strong> Lista de productos publicados con su
                  <code className="text-primary mx-1">name</code>,
                  <code className="text-primary mx-1">sku</code>,
                  <code className="text-primary mx-1">price</code>,
                  <code className="text-primary mx-1">stock_quantity</code>,
                  <code className="text-primary mx-1">category</code> y fotos.
                </div>
              </div>
            </ModalBody>

            <Divider />

            <ModalFooter className="py-1.5 px-3 flex items-center justify-end gap-1.5 shrink-0">
              <Button variant="flat" size="sm" onPress={onClose} className="font-semibold text-xs h-8">
                Cerrar
              </Button>
            </ModalFooter>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};
