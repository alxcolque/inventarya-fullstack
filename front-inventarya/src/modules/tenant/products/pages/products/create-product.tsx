import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Chip,
  Spinner,
  Tooltip,
} from "@nextui-org/react";
import {
  LuPackage,
  LuUploadCloud,
  LuTrash2,
  LuLayers,
  LuTag,
  LuFileText,
  LuCheck,
  LuArrowLeft,
  LuBoxes,
  LuCamera,
} from "react-icons/lu";
import { FaBarcode } from "react-icons/fa6";
import { toast } from "sonner";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useProductsStore } from "../../store/products/products.store";
import { useCategoriesStore } from "../../store/categories/categories.store";
import { useBrandsStore } from "../../store/brands/brands.store";
import { getImageUrl } from "@/utils/image";
import { Capacitor } from "@capacitor/core";
import { selectNativePhoto } from "@/services/cameraService";
import { ProductCameraModal } from "@/components/common/ProductCameraModal";
import { ImageCropperModal } from "@/components/common/ImageCropperModal";
import { validateImageFile } from "@/utils/image-crop";
import { ProductQuickNavigator } from "../../components/ProductQuickNavigator";
import { BarcodeScannerModal } from "@/modules/tenant/pos/pages/pos/components/BarcodeScannerModal";
import { useTenantBusinessTypeFieldsStore } from "../../store/products/business-type-fields.store";
import {
  AttributeErrors,
  AttributeValues,
  DynamicProductAttributes,
  validateDynamicAttributes,
} from "../../components/DynamicProductAttributes";

interface CreateProductProps {
  isEditing?: boolean;
}

export const CreateProduct = ({ isEditing: propIsEditing }: CreateProductProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  const isEditing = Boolean(
    propIsEditing || (id && id !== "create" && location.pathname.includes("/edit"))
  );

  const token = useTenantAuthStore((state) => state.token);

  // Stores
  const createProduct = useProductsStore((state) => state.createProduct);
  const updateProduct = useProductsStore((state) => state.updateProduct);
  const getProduct = useProductsStore((state) => state.getProduct);

  const categories = useCategoriesStore((state) => state.categories);
  const getCategories = useCategoriesStore((state) => state.getCategories);

  const brands = useBrandsStore((state) => state.brands);
  const getBrands = useBrandsStore((state) => state.getBrands);

  const businessType = useTenantBusinessTypeFieldsStore((state) => state.businessType);
  const dynamicFields = useTenantBusinessTypeFieldsStore((state) => state.fields);
  const fetchDynamicFields = useTenantBusinessTypeFieldsStore((state) => state.fetchFields);

  // Form states
  const [name, setName] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [brandId, setBrandId] = useState<string>("");
  const [sku, setSku] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [attributes, setAttributes] = useState<AttributeValues>({});
  const [attributeErrors, setAttributeErrors] = useState<AttributeErrors>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState<boolean>(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState<boolean>(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState<boolean>(false);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState<boolean>(isEditing);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buscar IDs por defecto ("VARIOS" y "DESCONOCIDO")
  const defaultCategory = useMemo(() => {
    return (
      categories.find(
        (c) => c.name?.toUpperCase() === "VARIOS" || c.slug?.toLowerCase() === "varios"
      ) || categories[0]
    );
  }, [categories]);

  const defaultBrand = useMemo(() => {
    return (
      brands.find(
        (b) => b.name?.toUpperCase() === "DESCONOCIDO" || b.slug?.toLowerCase() === "desconocido"
      ) || brands[0]
    );
  }, [brands]);

  // Preview del prefijo de SKU calculado en base al nombre ingresado
  const calculatedSkuPrefix = useMemo(() => {
    if (!name.trim()) return "";
    const clean = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const prefix = clean.slice(0, 3);
    return prefix.padEnd(3, "X");
  }, [name]);

  // Cargar categorías, marcas y campos del tipo de negocio si no están cargados
  useEffect(() => {
    if (categories.length === 0) getCategories(token || undefined);
    if (brands.length === 0) getBrands(token || undefined);
    fetchDynamicFields();
  }, [categories.length, brands.length, getCategories, getBrands, fetchDynamicFields, token]);

  // Si no está editando y se cargan las categorías/marcas, asignar valores por defecto si aún no hay
  useEffect(() => {
    if (!isEditing) {
      if (!categoryId && defaultCategory?.id) {
        setCategoryId(String(defaultCategory.id));
      }
      if (!brandId && defaultBrand?.id) {
        setBrandId(String(defaultBrand.id));
      }
    }
  }, [isEditing, defaultCategory, defaultBrand, categoryId, brandId]);

  // Si está en modo edición, cargar datos del producto
  useEffect(() => {
    if (isEditing) {
      const cleanId = String(id || "").trim();
      if (!cleanId || cleanId === "NaN" || cleanId === "undefined" || cleanId === "null") {
        toast.error("Identificador de producto no válido");
        navigate("/products");
        return;
      }

      setIsLoadingProduct(true);
      getProduct(cleanId, token || undefined)
        .then((prod) => {
          if (prod) {
            setName(prod.name || "");
            setCategoryId(
              prod.category_id
                ? String(prod.category_id)
                : defaultCategory?.id
                  ? String(defaultCategory.id)
                  : ""
            );
            setBrandId(
              prod.brand_id
                ? String(prod.brand_id)
                : defaultBrand?.id
                  ? String(defaultBrand.id)
                  : ""
            );
            setSku(prod.sku || "");
            setBarcode(prod.barcode || "");
            setDescription(prod.description || "");
            setAttributes(
              prod.attributes && typeof prod.attributes === "object" ? prod.attributes : {}
            );
            setAttributeErrors({});
            const existingImg = prod.image || prod.thumbnail;
            if (existingImg) {
              setImagePreview(getImageUrl(existingImg));
              setImageBase64(null);
            }
          } else {
            toast.error("No se pudo cargar el producto para editar");
            navigate("/products");
          }
        })
        .catch(() => {
          toast.error("Error al cargar el producto para editar");
          navigate("/products");
        })
        .finally(() => {
          setIsLoadingProduct(false);
        });
    }
  }, [isEditing, id, token, getProduct, defaultCategory, defaultBrand, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      toast.error(validation.error || "Archivo no válido");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setRawImageSrc(result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (_blob: Blob, croppedBase64: string) => {
    setImagePreview(croppedBase64);
    setImageBase64(croppedBase64);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenCamera = async () => {
    if (Capacitor.isNativePlatform()) {
      setIsCameraLoading(true);
      try {
        const photo = await selectNativePhoto("camera");
        if (photo) {
          setRawImageSrc(photo);
          setCropModalOpen(true);
        }
      } catch (err: unknown) {
        console.error("Camera error:", err);
        const errMessage = err instanceof Error ? err.message : "No se pudo abrir la cámara.";
        toast.error(errMessage);
      } finally {
        setIsCameraLoading(false);
      }
    } else {
      setCameraModalOpen(true);
    }
  };

  const handleCameraCapture = (dataUrl: string) => {
    setRawImageSrc(dataUrl);
    setCropModalOpen(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      toast.error(validation.error || "Archivo no válido");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setRawImageSrc(result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!name.trim()) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }

    if (barcode && barcode.trim().length > 100) {
      toast.error("El código de barras no debe exceder los 100 caracteres");
      return;
    }

    const attrErrors = validateDynamicAttributes(dynamicFields, attributes);
    if (Object.keys(attrErrors).length > 0) {
      setAttributeErrors(attrErrors);
      toast.error(Object.values(attrErrors)[0]);
      return;
    }
    setAttributeErrors({});

    setIsSubmitting(true);

    const payload: any = {
      name: name.trim(),
      category_id: categoryId && !isNaN(Number(categoryId)) ? Number(categoryId) : (defaultCategory?.id ?? null),
      brand_id: brandId && !isNaN(Number(brandId)) ? Number(brandId) : (defaultBrand?.id ?? null),
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || null,
      description: description.trim() || null,
    };

    if (dynamicFields.length > 0) {
      const cleanAttributes: Record<string, any> = {};
      for (const field of dynamicFields) {
        if (field.key in attributes) {
          cleanAttributes[field.key] = attributes[field.key];
        } else if (field.type === "boolean") {
          cleanAttributes[field.key] = false;
        }
      }
      payload.attributes = cleanAttributes;
    }

    if (imageBase64) {
      payload.image = imageBase64;
    }

    let success = false;
    if (isEditing && id) {
      success = await updateProduct(id, payload, token || undefined);
      if (success) {
        setImageBase64(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        const fresh = await getProduct(id, token || undefined);
        if (fresh) {
          setName(fresh.name || "");
          setCategoryId(
            fresh.category_id
              ? String(fresh.category_id)
              : defaultCategory?.id
                ? String(defaultCategory.id)
                : ""
          );
          setBrandId(
            fresh.brand_id
              ? String(fresh.brand_id)
              : defaultBrand?.id
                ? String(defaultBrand.id)
                : ""
          );
          setSku(fresh.sku || "");
          setBarcode(fresh.barcode || "");
          setDescription(fresh.description || "");
          setAttributes(
            fresh.attributes && typeof fresh.attributes === "object" ? fresh.attributes : {}
          );
          const freshImg = fresh.image || fresh.thumbnail;
          if (freshImg) {
            setImagePreview(getImageUrl(freshImg));
          } else {
            setImagePreview(null);
          }
        }
      }
    } else {
      success = await createProduct(payload, token || undefined);
      if (success) {
        navigate("/products");
      }
    }

    setIsSubmitting(false);
  };

  if (isLoadingProduct) {
    return (
      <div className="my-2 px-3 sm:px-6 max-w-[85rem] mx-auto w-full flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Spinner size="lg" color="primary" />
        <p className="text-default-500 font-medium text-sm">Cargando datos del producto...</p>
      </div>
    );
  }

  return (
    <div className="my-2 px-3 sm:px-6 max-w-[85rem] mx-auto w-full flex flex-col gap-5">
      {/* Breadcrumbs */}
      <DynamicBreadcrumbs title={isEditing ? "Editar Producto" : "Nuevo Producto"} />

      {/* Quick Navigator cuando está en modo edición */}
      {isEditing && id && (
        <ProductQuickNavigator currentProductId={id} mode="edit" />
      )}

      {/* Header con botón de volver y acciones rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="flat"
            size="md"
            onPress={() => navigate("/products")}
            aria-label="Volver al catálogo"
            className="rounded-xl border border-default-200"
          >
            <LuArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
                <LuBoxes className="text-primary text-2xl" />
                {isEditing ? "Editar Producto" : "Nuevo Producto"}
              </h1>
              <Chip size="sm" variant="flat" color="primary" className="font-semibold">
                {isEditing ? "Edición" : "Catálogo"}
              </Chip>
            </div>
            <p className="text-xs sm:text-sm text-default-500 mt-0.5">
              {isEditing
                ? "Modifica los atributos comerciales e inventario del producto"
                : "Registra un producto en el catálogo. La categoría varios y marca desconocida están asignadas por defecto."}
            </p>
          </div>
        </div>
      </div>

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Columna Izquierda: Imagen y SKU Sugerido */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <Card className="border border-default-200 shadow-sm bg-content1 rounded-2xl">
              <CardHeader className="py-3 px-4 border-b border-default-100 flex items-center justify-between">
                <span className="text-xs font-bold text-default-700 uppercase tracking-wider">
                  Foto Principal
                </span>
                {imagePreview && (
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    startContent={<LuTrash2 size={13} />}
                    onPress={handleRemoveImage}
                    className="h-7 text-xs font-semibold px-2"
                  >
                    Quitar
                  </Button>
                )}
              </CardHeader>
              <CardBody className="p-4 flex flex-col gap-3">
                {/* Zona de Drop & Drop y Vista Previa */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative group border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-3 sm:p-4 transition-all duration-300 min-h-[190px] sm:min-h-[220px] ${
                    isDragging
                      ? "border-primary bg-primary/10 scale-[1.01]"
                      : imagePreview
                        ? "border-primary/40 bg-primary/5"
                        : "border-default-300 hover:border-primary/60 hover:bg-default-100/40"
                  }`}
                >
                  {imagePreview ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <img
                        src={imagePreview}
                        alt="Vista previa"
                        className="w-full h-40 sm:h-48 object-contain rounded-xl drop-shadow-md"
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer flex flex-col items-center text-center gap-2 p-2 w-full"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-all">
                        <LuCamera size={24} />
                      </div>
                      <div className="text-xs">
                        <span className="font-bold text-foreground">
                          Arrastra o sube una imagen
                        </span>
                        <p className="text-default-400 mt-1 text-[11px]">
                          PNG, JPG, WEBP hasta 5MB (cuadrado 1:1)
                        </p>
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Acciones de cámara y subida directa */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    type="button"
                    color="primary"
                    variant="solid"
                    size="sm"
                    startContent={<LuCamera size={16} />}
                    onPress={handleOpenCamera}
                    isLoading={isCameraLoading}
                    className="font-bold text-xs shadow-sm h-9"
                  >
                    {imagePreview ? "Tomar otra" : "Tomar Foto"}
                  </Button>

                  <Button
                    type="button"
                    color="default"
                    variant="flat"
                    size="sm"
                    startContent={<LuUploadCloud size={16} />}
                    onPress={() => fileInputRef.current?.click()}
                    className="font-semibold text-xs h-9 text-default-700 hover:text-foreground"
                  >
                    {imagePreview ? "Cambiar foto" : "Subir archivo"}
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Ficha de SKU sugerido */}
            <Card className="border border-default-200 shadow-sm bg-content1 rounded-2xl">
              <CardBody className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-default-600 uppercase tracking-wider">
                    SKU Sugerido
                  </span>
                  <Chip size="sm" variant="flat" color="primary" className="font-mono font-bold text-xs">
                    {calculatedSkuPrefix ? `${calculatedSkuPrefix}-####` : "AUTO"}
                  </Chip>
                </div>
                <p className="text-xs text-default-400 leading-relaxed">
                  El sistema genera un código consecutivo automático y único basado en el nombre comercial (ej:{" "}
                  <span className="font-mono font-bold text-foreground">
                    {calculatedSkuPrefix || "TED"}-0001
                  </span>
                  ). Puedes ingresar un SKU personalizado a la derecha si lo requieres.
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Columna Derecha: Datos Principales */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            <Card className="border border-default-200 shadow-sm bg-content1 rounded-2xl">
              <CardHeader className="py-3 px-5 border-b border-default-100">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Información Básica
                </h3>
              </CardHeader>
              <CardBody className="p-5 flex flex-col gap-5">
                {/* Nombre */}
                <Input
                  label="Nombre del Producto"
                  placeholder="Ej: Te Verde Supremo 100g"
                  variant="bordered"
                  isRequired
                  value={name}
                  onValueChange={setName}
                  startContent={<LuPackage className="text-default-400 text-lg" />}
                  classNames={{
                    label: "text-xs font-semibold",
                    input: "text-sm",
                  }}
                />

                {/* Categoría y Marca */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Categoría */}
                  <Select
                    label="Categoría"
                    placeholder="Selecciona categoría"
                    variant="bordered"
                    selectedKeys={categoryId ? [categoryId] : []}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as string;
                      setCategoryId(selected || "");
                    }}
                    startContent={<LuLayers className="text-default-400 text-base" />}
                    description={
                      defaultCategory && String(defaultCategory.id) === categoryId
                        ? "Valor por defecto (VARIOS)"
                        : undefined
                    }
                    classNames={{
                      label: "text-xs font-semibold",
                    }}
                  >
                    {categories.map((cat) => (
                      <SelectItem key={String(cat.id)} textValue={cat.full_path || cat.name}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color || "#6366f1" }}
                          />
                          <span className="text-xs truncate">{cat.full_path || cat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>

                  {/* Marca */}
                  <Select
                    label="Marca"
                    placeholder="Selecciona marca"
                    variant="bordered"
                    selectedKeys={brandId ? [brandId] : []}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as string;
                      setBrandId(selected || "");
                    }}
                    startContent={<LuTag className="text-default-400 text-base" />}
                    description={
                      defaultBrand && String(defaultBrand.id) === brandId
                        ? "Valor por defecto (DESCONOCIDO)"
                        : undefined
                    }
                    classNames={{
                      label: "text-xs font-semibold",
                    }}
                  >
                    {brands.map((b) => (
                      <SelectItem key={String(b.id)} textValue={b.name}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{b.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                {/* Código de Barras y SKU */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Código de Barras (Opcional)"
                    placeholder="Ej: 7771234567890 o 00N1"
                    variant="bordered"
                    value={barcode}
                    onValueChange={(val) => {
                      setBarcode(val);
                    }}
                    startContent={<FaBarcode className="text-default-400 text-base" />}
                    endContent={
                      <Tooltip content="Escanear con cámara">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="text-default-400 hover:text-primary min-w-unit-8 w-8 h-8"
                          onPress={() => setBarcodeScannerOpen(true)}
                          aria-label="Escanear código de barras con la cámara"
                        >
                          <LuCamera className="text-base" />
                        </Button>
                      </Tooltip>
                    }
                    description="Alfanumérico (letras y números como 00N1). Compatible con escáneres y POS."
                    classNames={{
                      label: "text-xs font-semibold",
                      input: "font-mono text-sm tracking-wider",
                    }}
                  />

                  <Input
                    label="SKU (Opcional manual)"
                    placeholder={calculatedSkuPrefix ? `${calculatedSkuPrefix}-0001` : "Auto-generado"}
                    variant="bordered"
                    value={sku}
                    onValueChange={(val) => setSku(val.toUpperCase())}
                    startContent={<LuTag className="text-default-400 text-base" />}
                    description="Déjalo vacío para auto-generar según el nombre."
                    classNames={{
                      label: "text-xs font-semibold",
                      input: "font-mono text-sm uppercase",
                    }}
                  />
                </div>

                {/* Descripción */}
                <Textarea
                  label="Descripción (Opcional)"
                  placeholder="Detalles, características, contenido o especificaciones del producto..."
                  variant="bordered"
                  minRows={3}
                  maxRows={5}
                  value={description}
                  onValueChange={setDescription}
                  startContent={<LuFileText className="text-default-400 text-base self-start mt-2" />}
                  classNames={{
                    label: "text-xs font-semibold",
                    input: "text-xs",
                  }}
                />
              </CardBody>
            </Card>

            {/* Atributos dinámicos según tipo de negocio */}
            <DynamicProductAttributes
              businessTypeName={businessType?.name}
              fields={dynamicFields}
              values={attributes}
              errors={attributeErrors}
              onChange={(key, value) => {
                setAttributes((prev) => ({ ...prev, [key]: value }));
                if (attributeErrors[key]) {
                  setAttributeErrors((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }
              }}
            />

            {/* Footer de acción inferior */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <span className="text-xs text-default-400">
                Campos con <span className="text-danger font-bold">*</span> son obligatorios
              </span>
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="flat"
                  color="default"
                  onPress={() => navigate("/products")}
                  isDisabled={isSubmitting}
                  className="font-semibold text-xs sm:text-sm"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  isLoading={isSubmitting}
                  startContent={!isSubmitting && <LuCheck size={17} />}
                  className="font-bold text-xs sm:text-sm shadow-sm"
                >
                  {isEditing ? "Actualizar Producto" : "Guardar Producto"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Modal de recorte de imagen cuadrado 1:1 */}
      <ImageCropperModal
        isOpen={cropModalOpen}
        imageSrc={rawImageSrc}
        aspectRatio={1}
        cropShape="rect"
        title={isEditing ? "Recortar Imagen del Producto" : "Recortar Imagen de Nuevo Producto"}
        subtitle="Ajusta y recorta la foto en formato cuadrado (1:1)"
        onClose={() => {
          setCropModalOpen(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        onConfirm={handleCropConfirm}
      />

      {/* Modal de captura de foto con cámara */}
      <ProductCameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        onFallbackToFileUpload={() => fileInputRef.current?.click()}
      />

      {/* Modal de escaneo de código de barras con cámara */}
      <BarcodeScannerModal
        isOpen={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onScan={(scannedCode) => {
          setBarcode(scannedCode);
          setBarcodeScannerOpen(false);
          toast.success(`Código escaneado: ${scannedCode}`);
        }}
      />
    </div>
  );
};
