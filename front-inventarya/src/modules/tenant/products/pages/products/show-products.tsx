import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Chip,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
} from "@nextui-org/react";
import {
  LuArrowLeft,
  LuPackage,
  LuPencil,
  LuTrash2,
  LuLayers,
  LuTag,
  LuFileText,
  LuCopy,
  LuCheck,
  LuUploadCloud,
  LuWarehouse,
  LuStore,
  LuImagePlus,
  LuCalendar,
  LuAlertTriangle,
  LuEye,
  LuShieldCheck,
  LuCamera,
} from "react-icons/lu";
import { FaBarcode } from "react-icons/fa6";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useProductsStore } from "../../store/products/products.store";
import { useProductImagesStore } from "../../store/products/product-images.store";
import { getImageUrl as getProductImageUrl } from "@/utils/image";
import { ImageCropperModal } from "@/components/common/ImageCropperModal";
import { ProductCameraModal } from "@/components/common/ProductCameraModal";
import { selectNativePhoto } from "@/services/cameraService";
import { validateImageFile } from "@/utils/image-crop";
import { ProductQuickNavigator } from "../../components/ProductQuickNavigator";

export const ShowProducts = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useTenantAuthStore((state) => state.token);
  const user = useTenantAuthStore((state) => state.user);
  const can = useTenantAuthStore((state) => state.can);

  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "owner" || role === "admin";
  const isStaff = !isAdmin;

  const canUpdate = isAdmin && can("products:update");
  const canDelete = isAdmin && can("products:delete");

  // Stores
  const product = useProductsStore((state) => state.product);
  const getProduct = useProductsStore((state) => state.getProduct);
  const updateProduct = useProductsStore((state) => state.updateProduct);
  const deleteProduct = useProductsStore((state) => state.deleteProduct);

  const productImages = useProductImagesStore((state) => state.productImages);
  const getProductImages = useProductImagesStore((state) => state.getProductImages);
  const createProductImage = useProductImagesStore((state) => state.createProductImage);
  const deleteProductImage = useProductImagesStore((state) => state.deleteProductImage);

  // States
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Gallery active image
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Camera & Photo Upload States (Parity with create-product)
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"main" | "gallery">("main");
  const [cropModalOpen, setCropModalOpen] = useState<boolean>(false);
  const [rawCropSrc, setRawCropSrc] = useState<string | null>(null);

  // Main Photo Edit States
  const [pendingMainPhoto, setPendingMainPhoto] = useState<string | null>(null);
  const [isSavingMainPhoto, setIsSavingMainPhoto] = useState(false);
  const [isMainDragging, setIsMainDragging] = useState(false);
  const mainFileInputRef = useRef<HTMLInputElement>(null);

  // Gallery Upload States
  const [galleryFilePreview, setGalleryFilePreview] = useState<string | null>(null);
  const [galleryFileBase64, setGalleryFileBase64] = useState<string | null>(null);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [isGalleryDragging, setIsGalleryDragging] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Image to delete modal
  const [imageToDelete, setImageToDelete] = useState<any | null>(null);
  const [isDeletingImage, setIsDeletingImage] = useState(false);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async () => {
    if (!id) return;
    setIsLoadingProduct(true);
    await Promise.all([
      getProduct(id, token || undefined),
      getProductImages(id, token || undefined),
    ]);
    setIsLoadingProduct(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Combine main image + gallery images
  const allImages = useMemo(() => {
    const list: Array<{ id?: number | string; url: string; isMain: boolean }> = [];
    const mainImg = product?.image || product?.thumbnail;
    if (mainImg) {
      list.push({
        url: getProductImageUrl(mainImg),
        isMain: true,
      });
    }

    if (Array.isArray(productImages)) {
      productImages.forEach((img: any) => {
        list.push({
          id: img.id,
          url: getProductImageUrl(img.image),
          isMain: false,
        });
      });
    }

    return list;
  }, [product, productImages]);

  // Handle active image safely
  const currentImage = allImages[activeImageIndex] || allImages[0] || null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Camera Handling (Capacitor native or Web Modal)
  const handleOpenCamera = async (target: "main" | "gallery") => {
    setCameraTarget(target);
    if (Capacitor.isNativePlatform()) {
      setIsCameraLoading(true);
      try {
        const photo = await selectNativePhoto("camera");
        if (photo) {
          setRawCropSrc(photo);
          setCropModalOpen(true);
        }
      } catch (err: unknown) {
        console.error("Camera error:", err);
        const errMessage =
          err instanceof Error ? err.message : "No se pudo abrir la cámara.";
        toast.error(errMessage);
      } finally {
        setIsCameraLoading(false);
      }
    } else {
      setCameraModalOpen(true);
    }
  };

  const handleCameraCapture = (dataUrl: string) => {
    setCameraModalOpen(false);
    setRawCropSrc(dataUrl);
    setCropModalOpen(true);
  };

  // Main Photo File Select
  const handleMainFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUpdate) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      toast.error(validation.error || "Archivo no válido");
      if (mainFileInputRef.current) mainFileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      setCameraTarget("main");
      setRawCropSrc(res);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Drag and Drop Handling
  const handleDragOver = (e: React.DragEvent, target: "main" | "gallery") => {
    e.preventDefault();
    e.stopPropagation();
    if (target === "main") setIsMainDragging(true);
    else setIsGalleryDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent, target: "main" | "gallery") => {
    e.preventDefault();
    e.stopPropagation();
    if (target === "main") setIsMainDragging(false);
    else setIsGalleryDragging(false);
  };

  const handleDrop = (e: React.DragEvent, target: "main" | "gallery") => {
    e.preventDefault();
    e.stopPropagation();
    if (target === "main") setIsMainDragging(false);
    else setIsGalleryDragging(false);

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
      setCameraTarget(target);
      setRawCropSrc(result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Upload gallery image (Admin only)
  const handleGalleryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, 5);
    if (!validation.valid) {
      toast.error(validation.error || "Archivo no válido");
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      setCameraTarget("gallery");
      setRawCropSrc(res);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (_blob: Blob, croppedBase64: string) => {
    if (cameraTarget === "main") {
      setPendingMainPhoto(croppedBase64);
    } else {
      setGalleryFilePreview(croppedBase64);
      setGalleryFileBase64(croppedBase64);
    }
  };

  const handleSaveMainPhoto = async () => {
    if (!pendingMainPhoto || !id || !product) return;
    setIsSavingMainPhoto(true);
    try {
      const success = await updateProduct(
        id,
        {
          name: product.name,
          image: pendingMainPhoto,
        },
        token || undefined
      );
      if (success) {
        setPendingMainPhoto(null);
        if (mainFileInputRef.current) mainFileInputRef.current.value = "";
        await Promise.all([
          getProduct(id, token || undefined),
          getProductImages(id, token || undefined),
        ]);
        setActiveImageIndex(0);
      }
    } catch (error) {
      console.error("Error al actualizar la foto principal:", error);
      toast.error("Error al guardar la foto principal");
    } finally {
      setIsSavingMainPhoto(false);
    }
  };

  const handleUploadGalleryImage = async () => {
    if (!galleryFileBase64 || !id || !isAdmin) return;
    setIsUploadingGallery(true);
    try {
      await createProductImage(
        {
          product_id: id,
          image: galleryFileBase64,
        },
        token || undefined
      );
      setGalleryFilePreview(null);
      setGalleryFileBase64(null);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      await getProductImages(id, token || undefined);
    } finally {
      setIsUploadingGallery(false);
    }
  };

  // Confirm delete single gallery image (Admin only)
  const handleConfirmDeleteImage = async () => {
    if (!imageToDelete?.id || !id || !isAdmin) return;
    setIsDeletingImage(true);
    try {
      await deleteProductImage(id, imageToDelete.id, token || undefined);
      setImageToDelete(null);
      setActiveImageIndex(0);
    } finally {
      setIsDeletingImage(false);
    }
  };

  // Handle product delete (Admin only)
  const handleConfirmDeleteProduct = async () => {
    if (!id || !isAdmin) return;
    setIsDeleting(true);
    const success = await deleteProduct(id, token || undefined);
    setIsDeleting(false);
    if (success) {
      navigate("/products");
    }
  };

  if (isLoadingProduct) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-2">
        <Spinner size="lg" color="primary" />
        <p className="text-xs text-default-500 font-medium">Cargando información del producto...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="my-4 px-2 max-w-4xl mx-auto flex flex-col items-center justify-center gap-2 text-center">
        <LuAlertTriangle size={36} className="text-warning" />
        <h2 className="text-lg font-bold text-foreground">Producto no encontrado</h2>
        <p className="text-xs text-default-500">
          El producto solicitado no existe o fue eliminado previamente.
        </p>
        <Button
          color="primary"
          variant="flat"
          size="sm"
          startContent={<LuArrowLeft size={14} />}
          onPress={() => {
            if (isAdmin) {
              navigate("/products");
            } else {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate("/shops");
              }
            }
          }}
        >
          {isAdmin ? "Volver a Productos" : "Volver"}
        </Button>
      </div>
    );
  }

  const warehouseList = (product as any).productInventoryWarehouse || [];
  const storeList = (product as any).productInventoryStore || [];

  // Computed stock totals
  const totalWarehouseStock = warehouseList.reduce((acc: number, wh: any) => acc + Number(wh.quantity || wh.stock_quantity || 0), 0);
  const totalStoreStock = storeList.reduce((acc: number, st: any) => acc + Number(st.quantity || st.stock_quantity || 0), 0);

  // Price resolution (with fallback to store inventory sale_price or warehouse price)
  const fallbackStorePrice = storeList.length > 0 ? Number(storeList[0]?.sale_price || storeList[0]?.price || 0) : 0;
  const fallbackWhPrice = warehouseList.length > 0 ? Number(warehouseList[0]?.price || 0) : 0;
  const primaryPrice = Number(product.price || fallbackStorePrice || fallbackWhPrice || 0);
  const salePrice = Number((product as any).sale_price || (product as any).saleprice || fallbackStorePrice || primaryPrice);
  const hasDiscount = salePrice > 0 && primaryPrice > 0 && salePrice < primaryPrice;

  return (
    <div className="my-1 px-2 max-w-[95rem] mx-auto w-full flex flex-col gap-2">
      {/* Breadcrumbs & Quick Navigator */}
      <div className="flex flex-col gap-2.5">
        <DynamicBreadcrumbs title={product?.name || "Detalle del Producto"} />
        <ProductQuickNavigator currentProductId={id} mode="show" />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              onPress={() => {
                if (isAdmin) {
                  navigate("/products");
                } else {
                  if (window.history.length > 1) {
                    navigate(-1);
                  } else {
                    navigate("/shops");
                  }
                }
              }}
              aria-label={isAdmin ? "Volver a productos" : "Volver"}
              className="bg-default-100 hover:bg-default-200 text-default-700 h-8 w-8 min-w-8"
            >
              <LuArrowLeft size={16} />
            </Button>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-foreground">
                  {product.name}
                </h1>
                {product.sku && (
                  <Chip size="sm" variant="flat" color="primary" className="font-mono font-bold text-xs h-5">
                    {product.sku}
                  </Chip>
                )}
                {(product as any).active === false ? (
                  <Chip size="sm" variant="flat" color="danger" className="text-xs font-bold h-5">Inactivo</Chip>
                ) : (
                  <Chip size="sm" variant="flat" color="success" className="text-xs font-bold h-5">Activo</Chip>
                )}
                {isStaff ? (
                  <Chip
                    size="sm"
                    variant="flat"
                    color="warning"
                    startContent={<LuEye size={12} className="ml-1" />}
                    className="text-xs font-semibold h-5"
                  >
                    Modo Solo Lectura (Staff)
                  </Chip>
                ) : (
                  <Chip
                    size="sm"
                    variant="flat"
                    color="secondary"
                    startContent={<LuShieldCheck size={12} className="ml-1" />}
                    className="text-xs font-semibold h-5"
                  >
                    Administrador
                  </Chip>
                )}
              </div>
              <p className="text-[11px] text-default-400 font-mono">
                slug: /{product.slug}
              </p>
            </div>
          </div>

          {/* Action Buttons: Exclusivo para administradores */}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              {canUpdate && (
                <Button
                  color="secondary"
                  variant="flat"
                  size="sm"
                  startContent={<LuPencil size={14} />}
                  onPress={() => navigate(`/products/${id}/edit`)}
                  className="font-semibold text-xs h-8"
                >
                  Editar Producto
                </Button>
              )}

              {canDelete && (
                <Button
                  color="danger"
                  variant="flat"
                  size="sm"
                  isIconOnly
                  onPress={() => setIsDeleteModalOpen(true)}
                  aria-label="Eliminar producto"
                  className="h-8 w-8 min-w-8"
                >
                  <LuTrash2 size={15} />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Divider className="my-0.5" />

      {/* Main Grid: Gallery on Left (5 cols), Details on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">
        {/* ===================== COLUMNA IZQUIERDA: GALERÍA DE IMÁGENES ===================== */}
        <div className="lg:col-span-5 flex flex-col gap-2">
          <Card className="bg-content1 shadow-none rounded-xl">
            <CardHeader className="py-1.5 px-2 flex items-center justify-between">
              <span className="text-xs font-bold text-default-700 uppercase tracking-wider flex items-center gap-1.5">
                <LuPackage size={14} /> Galería de Producto
              </span>
              <span className="text-xs text-default-400 font-semibold">
                {allImages.length} {allImages.length === 1 ? "imagen" : "imágenes"}
              </span>
            </CardHeader>
            <Divider />

            <CardBody className="p-2 flex flex-col gap-2">
              {/* Visor Principal Activo (Con soporte de arrastrar y soltar) */}
              <div
                onDragOver={(e) => {
                  if (canUpdate && (currentImage?.isMain || allImages.length === 0)) {
                    handleDragOver(e, "main");
                  }
                }}
                onDragLeave={(e) => {
                  if (canUpdate && (currentImage?.isMain || allImages.length === 0)) {
                    handleDragLeave(e, "main");
                  }
                }}
                onDrop={(e) => {
                  if (canUpdate && (currentImage?.isMain || allImages.length === 0)) {
                    handleDrop(e, "main");
                  }
                }}
                className={`relative w-full h-64 sm:h-80 rounded-xl bg-default-50/70 flex items-center justify-center p-2 overflow-hidden group transition-all duration-200 ${
                  isMainDragging
                    ? "ring-2 ring-primary ring-offset-2 bg-primary/10"
                    : ""
                }`}
              >
                {pendingMainPhoto ? (
                  <>
                    <img
                      src={pendingMainPhoto}
                      alt="Nueva foto previa"
                      className="w-full h-full object-contain drop-shadow-sm rounded-lg"
                    />
                    <Chip
                      size="sm"
                      color="warning"
                      variant="solid"
                      className="absolute top-2 left-2 text-[10px] font-bold uppercase shadow-sm h-5"
                    >
                      Vista Previa (Sin Guardar)
                    </Chip>
                  </>
                ) : currentImage ? (
                  <>
                    <img
                      src={currentImage.url}
                      alt={product.name}
                      className="w-full h-full object-contain drop-shadow-sm rounded-lg transition-transform duration-300 group-hover:scale-105"
                    />
                    {currentImage.isMain ? (
                      <Chip
                        size="sm"
                        color="primary"
                        variant="solid"
                        className="absolute top-2 left-2 text-[10px] font-bold uppercase shadow-sm h-5"
                      >
                        Imagen Principal
                      </Chip>
                    ) : (
                      isAdmin && (
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <Button
                            size="sm"
                            isIconOnly
                            color="danger"
                            variant="flat"
                            className="bg-background/80 backdrop-blur-md text-danger shadow-sm h-7 w-7 min-w-7"
                            onPress={() => setImageToDelete(currentImage)}
                            aria-label="Eliminar imagen"
                          >
                            <LuTrash2 size={13} />
                          </Button>
                        </div>
                      )
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-default-400">
                    <LuPackage size={36} className="opacity-30" />
                    <p className="text-xs font-medium">Sin imagen principal registrada</p>
                  </div>
                )}

                <input
                  ref={mainFileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleMainFileSelect}
                  className="hidden"
                />
              </div>

              {/* Confirmación de Nueva Foto Principal */}
              {pendingMainPhoto && (
                <div className="p-2.5 bg-warning-50/80 border border-warning-200 dark:bg-warning-950/30 dark:border-warning-800/40 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={pendingMainPhoto}
                      alt="Nueva foto principal"
                      className="w-10 h-10 rounded-lg object-cover border border-warning-300 dark:border-warning-700 shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">
                        Nueva foto principal
                      </span>
                      <span className="text-[10px] text-default-500">
                        ¿Deseas guardar esta foto para el producto?
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="light"
                      className="h-8 text-xs font-medium"
                      onPress={() => {
                        setPendingMainPhoto(null);
                        if (mainFileInputRef.current) mainFileInputRef.current.value = "";
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      isLoading={isSavingMainPhoto}
                      startContent={!isSavingMainPhoto && <LuCheck size={14} />}
                      onPress={handleSaveMainPhoto}
                      className="font-bold text-xs h-8 shadow-sm"
                    >
                      Guardar Foto
                    </Button>
                  </div>
                </div>
              )}

              {/* Botones de acción directa para Foto Principal (Tomar Foto / Subir) */}
              {!pendingMainPhoto && canUpdate && (currentImage?.isMain || allImages.length === 0) && (
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <Button
                    type="button"
                    color="primary"
                    variant="solid"
                    size="sm"
                    startContent={<LuCamera size={15} />}
                    onPress={() => handleOpenCamera("main")}
                    isLoading={isCameraLoading && cameraTarget === "main"}
                    className="font-bold text-xs shadow-sm h-8"
                  >
                    {product?.image ? "Tomar otra" : "Tomar Foto"}
                  </Button>

                  <Button
                    type="button"
                    color="default"
                    variant="flat"
                    size="sm"
                    startContent={<LuUploadCloud size={15} />}
                    onPress={() => mainFileInputRef.current?.click()}
                    className="font-semibold text-xs h-8 text-default-700 hover:text-foreground"
                  >
                    {product?.image ? "Cambiar foto" : "Subir archivo"}
                  </Button>
                </div>
              )}

              {/* Tira de Miniaturas (Thumbnails) */}
              {allImages.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  {allImages.map((img, idx) => {
                    const isActive = idx === activeImageIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative shrink-0 w-14 h-14 rounded-lg transition-all duration-200 overflow-hidden bg-default-50 p-1 ${isActive
                          ? "ring-2 ring-primary scale-105"
                          : "opacity-75 hover:opacity-100"
                          }`}
                      >
                        <img
                          src={img.url}
                          alt={`Miniatura ${idx + 1}`}
                          className="w-full h-full object-contain rounded-md"
                        />
                        {img.isMain && (
                          <span className="absolute bottom-0 left-0 right-0 bg-primary/90 text-white text-[8px] font-bold text-center py-0.5">
                            MAIN
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Botón y Dropzone para Añadir Más Imágenes (Solo Administradores) */}
              {isAdmin && (
                <>
                  <Divider className="my-0.5" />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-default-700">
                      Añadir más fotos a la galería
                    </span>

                    {/* Zona de Drop & Drop para galería */}
                    <div
                      onDragOver={(e) => handleDragOver(e, "gallery")}
                      onDragLeave={(e) => handleDragLeave(e, "gallery")}
                      onDrop={(e) => handleDrop(e, "gallery")}
                      onClick={() => galleryInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-2.5 flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
                        isGalleryDragging
                          ? "border-primary bg-primary/10"
                          : "border-default-300 hover:border-primary/60 hover:bg-default-50/70"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <LuImagePlus size={16} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-semibold text-foreground">
                          Arrastra o haz clic para subir foto adicional
                        </span>
                        <span className="text-[10px] text-default-400">
                          PNG, JPG, WEBP hasta 5MB (recorte cuadrado 1:1)
                        </span>
                      </div>
                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleGalleryFileSelect}
                        className="hidden"
                      />
                    </div>

                    {/* Acciones de cámara y archivo para galería */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <Button
                        type="button"
                        color="primary"
                        variant="solid"
                        size="sm"
                        startContent={<LuCamera size={15} />}
                        onPress={() => handleOpenCamera("gallery")}
                        isLoading={isCameraLoading && cameraTarget === "gallery"}
                        className="font-bold text-xs shadow-sm h-8"
                      >
                        Tomar Foto
                      </Button>

                      <Button
                        type="button"
                        color="default"
                        variant="flat"
                        size="sm"
                        startContent={<LuUploadCloud size={15} />}
                        onPress={() => galleryInputRef.current?.click()}
                        className="font-semibold text-xs h-8 text-default-700 hover:text-foreground"
                      >
                        Subir archivo
                      </Button>
                    </div>

                    {/* Previsualización antes de confirmar subida a galería */}
                    {galleryFilePreview && (
                      <div className="p-2.5 bg-default-100/70 rounded-xl flex items-center justify-between gap-2 animate-in fade-in">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={galleryFilePreview}
                            alt="Nueva foto"
                            className="w-10 h-10 rounded-lg object-cover border border-default-200 shrink-0"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-foreground truncate">
                              Foto lista para galería
                            </span>
                            <span className="text-[10px] text-default-500">
                              Se añadirá a la galería del producto
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="light"
                            className="h-8 text-xs"
                            onPress={() => {
                              setGalleryFilePreview(null);
                              setGalleryFileBase64(null);
                              if (galleryInputRef.current) galleryInputRef.current.value = "";
                            }}
                          >
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            color="primary"
                            isLoading={isUploadingGallery}
                            startContent={!isUploadingGallery && <LuUploadCloud size={14} />}
                            onPress={handleUploadGalleryImage}
                            className="font-bold text-xs h-8"
                          >
                            Subir Foto
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ===================== COLUMNA DERECHA: INFORMACIÓN DETALLADA ===================== */}
        <div className="lg:col-span-7 flex flex-col gap-2">
          {/* Tarjeta de Ficha Técnica Principal */}
          <Card className="bg-content1 shadow-none rounded-xl">
            <CardHeader className="py-1.5 px-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <LuFileText className="text-primary" size={16} />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                  Información del Producto
                </h3>
              </div>
              <span className="text-xs text-default-400">ID #{product.id}</span>
            </CardHeader>
            <Divider />

            <CardBody className="p-2 flex flex-col gap-2">
              {/* Badges y Chips Principales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* SKU */}
                <div className="p-2 bg-default-50/80 rounded-xl flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">
                    Código SKU
                  </span>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono font-extrabold text-xs sm:text-sm text-foreground">
                      {product.sku || "Sin SKU"}
                    </span>
                    {product.sku && (
                      <Tooltip content={copiedKey === "sku" ? "¡Copiado!" : "Copiar SKU"}>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="h-6 w-6 min-w-6"
                          onPress={() => handleCopy(product.sku!, "sku")}
                        >
                          {copiedKey === "sku" ? (
                            <LuCheck size={13} className="text-success" />
                          ) : (
                            <LuCopy size={13} className="text-default-500" />
                          )}
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Código de barras */}
                <div className="p-2 bg-default-50/80 rounded-xl flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider flex items-center gap-1">
                    <FaBarcode size={12} /> Código de Barras
                  </span>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono font-extrabold text-xs sm:text-sm text-foreground">
                      {product.barcode || "Sin código de barras"}
                    </span>
                    {product.barcode && (
                      <Tooltip content={copiedKey === "barcode" ? "¡Copiado!" : "Copiar código"}>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="h-6 w-6 min-w-6"
                          onPress={() => handleCopy(product.barcode!, "barcode")}
                        >
                          {copiedKey === "barcode" ? (
                            <LuCheck size={13} className="text-success" />
                          ) : (
                            <LuCopy size={13} className="text-default-500" />
                          )}
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>

              <Divider className="my-0.5" />

              {/* Categoría y Marca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Categoría */}
                <div className="flex flex-col gap-1 p-2 bg-default-50/80 rounded-xl">
                  <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider flex items-center gap-1">
                    <LuLayers size={12} /> Categoría
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: product.color || "#6366f1" }}
                    />
                    <span className="font-semibold text-xs sm:text-sm text-foreground">
                      {product.category_path || product.category}
                    </span>
                  </div>
                </div>

                {/* Marca */}
                <div className="flex flex-col gap-1 p-2 bg-default-50/80 rounded-xl">
                  <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider flex items-center gap-1">
                    <LuTag size={12} /> Marca
                  </span>
                  <span className="font-semibold text-xs sm:text-sm text-foreground">
                    {product.brand || "DESCONOCIDO"}
                  </span>
                </div>
              </div>

              <Divider className="my-0.5" />

              {/* Descripción */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-default-500 uppercase tracking-wider">
                  Descripción
                </span>
                <div className="p-2 bg-default-50/80 rounded-xl text-xs text-default-700 leading-relaxed min-h-[50px]">
                  {product.description ? (
                    <p className="whitespace-pre-line">{product.description}</p>
                  ) : (
                    <p className="text-default-400 italic">Sin descripción registrada para este producto.</p>
                  )}
                </div>
              </div>

              {/* Precio */}
              {primaryPrice > 0 && (
                <>
                  <Divider className="my-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-default-500 uppercase tracking-wider">Precio de Venta</span>
                    <div className="flex items-end gap-2">
                      {hasDiscount && (
                        <span className="text-sm text-default-400 line-through font-mono">
                          {primaryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                      <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                        {(hasDiscount ? salePrice : primaryPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {hasDiscount && (
                        <Chip size="sm" color="danger" variant="flat" className="text-[10px] font-bold h-5 mb-0.5">
                          -{Math.round(100 - (salePrice / primaryPrice) * 100)}% OFF
                        </Chip>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Divider className="my-0.5" />

              {/* Auditoría / Fechas */}
              <div className="pt-1 flex flex-wrap items-center justify-between text-[10px] text-default-400 gap-1.5">
                <span className="flex items-center gap-1">
                  <LuCalendar size={12} /> Registrado:{" "}
                  <strong className="text-default-600 font-semibold">
                    {product.created_at ? new Date(product.created_at).toLocaleString() : "N/D"}
                  </strong>
                </span>
                <span>
                  Última modificación:{" "}
                  <strong className="text-default-600 font-semibold">
                    {product.updated_at ? new Date(product.updated_at).toLocaleString() : "N/D"}
                  </strong>
                </span>
              </div>
            </CardBody>
          </Card>

          {/* Existencias e Inventario (Almacenes y Tiendas) */}
          <Card className="bg-content1 shadow-none rounded-xl">
            <CardHeader className="py-1.5 px-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <LuWarehouse className="text-primary" size={16} />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                  Existencias e Inventario
                </h3>
              </div>
              <span className="text-xs text-default-400 font-semibold">
                Almacenes &amp; Sucursales
              </span>
            </CardHeader>
            <Divider />

            {/* Stock Summary Bar */}
            <div className="grid grid-cols-2 gap-2 p-2">
              <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <LuWarehouse size={11} /> En Almacenes
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-blue-700 dark:text-blue-300 font-mono">
                  {totalWarehouseStock}
                </span>
                <span className="text-[10px] text-blue-500 dark:text-blue-400">unidades totales</span>
              </div>
              <div className="flex flex-col gap-0.5 p-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <LuStore size={11} /> En Tiendas
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 font-mono">
                  {totalStoreStock}
                </span>
                <span className="text-[10px] text-emerald-500 dark:text-emerald-400">unidades totales</span>
              </div>
            </div>

            <Divider />

            <CardBody className="p-2">
              <Tabs
                aria-label="Opciones de inventario"
                variant="underlined"
                color="primary"
                classNames={{
                  tabList: "gap-2 border-b border-divider",
                  cursor: "w-full bg-primary",
                  tab: "max-w-fit px-1 h-8 text-xs font-bold uppercase",
                }}
              >
                {/* Pestaña Almacenes */}
                <Tab
                  key="warehouses"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuWarehouse size={14} />
                      <span>Almacenes</span>
                      <Chip size="sm" variant="flat" color="default" className="text-[10px] h-4.5 px-1.5">
                        {warehouseList.length}
                      </Chip>
                    </div>
                  }
                >
                  <div className="pt-2">
                    {warehouseList.length > 0 ? (
                      <Table aria-label="Tabla de inventario en almacenes" removeWrapper>
                        <TableHeader>
                          <TableColumn className="bg-default-50 text-[10px] font-bold uppercase py-1.5 px-2">
                            UBICACIÓN / ALMACÉN
                          </TableColumn>
                          <TableColumn className="bg-default-50 text-[10px] font-bold uppercase text-center py-1.5 px-2">
                            EXISTENCIAS
                          </TableColumn>
                          <TableColumn className="bg-default-50 text-[10px] font-bold uppercase text-center py-1.5 px-2">
                            COSTO REF.
                          </TableColumn>
                          <TableColumn className="bg-default-50 text-[10px] font-bold uppercase text-right py-1.5 px-2">
                            ESTADO
                          </TableColumn>
                        </TableHeader>
                        <TableBody>
                          {warehouseList.map((wh: any, i: number) => {
                            const qty = Number(wh.quantity || 0);
                            const unitPrice = Number(wh.price || 0);
                            return (
                              <TableRow key={i} className="border-b border-divider/40">
                                <TableCell className="text-xs font-semibold text-foreground py-1.5 px-2">
                                  {wh.location_path || wh.location_name || "Almacén Central"}
                                </TableCell>
                                <TableCell className="text-xs font-bold text-center font-mono py-1.5 px-2">
                                  {qty}
                                </TableCell>
                                <TableCell className="text-xs text-center font-mono text-default-600 py-1.5 px-2">
                                  {unitPrice > 0 ? `Bs. ${unitPrice.toFixed(2)}` : "-"}
                                </TableCell>
                                <TableCell className="text-right py-1.5 px-2">
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={qty > 0 ? "success" : "danger"}
                                    className="text-[10px] font-bold uppercase h-5"
                                  >
                                    {qty > 0 ? "En Stock" : "Sin Stock"}
                                  </Chip>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-4 flex flex-col items-center justify-center gap-1 text-default-400">
                        <LuWarehouse size={24} className="opacity-40" />
                        <p className="text-xs font-medium">Sin registros de stock en almacenes</p>
                      </div>
                    )}
                  </div>
                </Tab>

                {/* Pestaña Tiendas */}
                <Tab
                  key="stores"
                  title={
                    <div className="flex items-center gap-1.5">
                      <LuStore size={14} />
                      <span>Tiendas / Sucursales</span>
                      <Chip size="sm" variant="flat" color="default" className="text-[10px] h-4.5 px-1.5">
                        {storeList.length}
                      </Chip>
                    </div>
                  }
                >
                  <div className="pt-2">
                    {storeList.length > 0 ? (
                      <Table aria-label="Tabla de inventario en tiendas" removeWrapper>
                        <TableHeader>
                          <TableColumn className="bg-default-50 text-[10px] font-bold uppercase py-1.5 px-2">
                            TIENDA
                          </TableColumn>
                          <TableColumn className="bg-default-50 text-[10px] font-bold uppercase py-1.5 px-2">
                            UBICACIÓN
                          </TableColumn>
                          <TableColumn className="bg-default-50 text-[10px] font-bold uppercase text-center py-1.5 px-2">
                            EXISTENCIAS
                          </TableColumn>
                          <TableColumn className="bg-default-50 text-[10px] font-bold uppercase text-right py-1.5 px-2">
                            PRECIO VENTA
                          </TableColumn>
                        </TableHeader>
                        <TableBody>
                          {storeList.map((st: any, i: number) => {
                            const qty = Number(st.quantity || 0);
                            const stPrice = Number(st.sale_price || st.price || 0);
                            return (
                              <TableRow key={i} className="border-b border-divider/40">
                                <TableCell className="text-xs font-semibold text-foreground py-1.5 px-2">
                                  {st.store_name || "Tienda"}
                                </TableCell>
                                <TableCell className="text-xs text-default-600 py-1.5 px-2">
                                  {st.location_path || st.location_name || "-"}
                                </TableCell>
                                <TableCell className="text-xs font-bold text-center font-mono py-1.5 px-2">
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={qty > 0 ? "success" : "danger"}
                                    className="text-xs font-mono font-bold h-5"
                                  >
                                    {qty}
                                  </Chip>
                                </TableCell>
                                <TableCell className="text-xs text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 py-1.5 px-2">
                                  {stPrice > 0 ? `Bs. ${stPrice.toFixed(2)}` : "-"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-4 flex flex-col items-center justify-center gap-1 text-default-400">
                        <LuStore size={24} className="opacity-40" />
                        <p className="text-xs font-medium">Sin registros de stock en tiendas</p>
                      </div>
                    )}
                  </div>
                </Tab>
              </Tabs>
            </CardBody>
          </Card>
        </div>
      </div>


      {/* Modal Confirmación de Eliminación de Foto de Galería (Solo Administradores) */}
      {isAdmin && (
        <Modal
          isOpen={imageToDelete !== null}
          onClose={() => setImageToDelete(null)}
          size="sm"
          backdrop="blur"
          classNames={{
            base: "bg-content1 shadow-xl rounded-xl",
          }}
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex items-center gap-2 text-danger py-2 px-3">
                  <LuAlertTriangle size={18} />
                  <span className="text-sm font-bold">Eliminar Imagen de Galería</span>
                </ModalHeader>
                <Divider />
                <ModalBody className="py-2 px-3">
                  <p className="text-xs sm:text-sm text-default-600">
                    ¿Estás seguro de que deseas quitar esta foto adicional de la galería?
                  </p>
                </ModalBody>
                <Divider />
                <ModalFooter className="py-1.5 px-3">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setImageToDelete(null)}
                    isDisabled={isDeletingImage}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    isLoading={isDeletingImage}
                    onPress={handleConfirmDeleteImage}
                    className="font-bold"
                  >
                    Sí, eliminar foto
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}

      {/* Modal Confirmación de Eliminación del Producto (Solo Administradores) */}
      {isAdmin && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          size="sm"
          backdrop="blur"
          classNames={{
            base: "bg-content1 shadow-xl rounded-xl",
          }}
        >
          <ModalContent>
            {() => (
              <>
                <ModalHeader className="flex items-center gap-2 text-danger py-2 px-3">
                  <LuAlertTriangle size={18} />
                  <span className="text-sm font-bold">Eliminar Producto</span>
                </ModalHeader>
                <Divider />
                <ModalBody className="py-2 px-3">
                  <p className="text-xs sm:text-sm text-default-600">
                    ¿Estás seguro de que deseas eliminar permanentemente el producto{" "}
                    <strong className="text-foreground">{product.name}</strong>?
                  </p>
                  <p className="text-[11px] text-default-400 mt-1">
                    Esta acción no se puede deshacer y borrará la galería e información asociada.
                  </p>
                </ModalBody>
                <Divider />
                <ModalFooter className="py-1.5 px-3">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setIsDeleteModalOpen(false)}
                    isDisabled={isDeleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    isLoading={isDeleting}
                    onPress={handleConfirmDeleteProduct}
                    className="font-bold"
                  >
                    Sí, eliminar producto
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}

      {/* Modal de Cámara para Web */}
      <ProductCameraModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onCapture={handleCameraCapture}
        onFallbackToFileUpload={() => {
          setCameraModalOpen(false);
          if (cameraTarget === "main") {
            mainFileInputRef.current?.click();
          } else {
            galleryInputRef.current?.click();
          }
        }}
      />

      {/* Modal de recorte de imagen (Foto principal o Galería) */}
      <ImageCropperModal
        isOpen={cropModalOpen}
        imageSrc={rawCropSrc}
        aspectRatio={1}
        cropShape="rect"
        title={cameraTarget === "main" ? "Recortar Foto Principal" : "Recortar Foto de Galería"}
        subtitle="Encuadra la foto del producto en formato cuadrado (1:1)"
        onClose={() => {
          setCropModalOpen(false);
          setRawCropSrc(null);
          if (mainFileInputRef.current) mainFileInputRef.current.value = "";
          if (galleryInputRef.current) galleryInputRef.current.value = "";
        }}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
};
