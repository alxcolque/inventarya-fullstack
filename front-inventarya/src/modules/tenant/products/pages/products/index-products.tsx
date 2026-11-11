import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Chip,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Skeleton,
  Avatar,
  Select,
  SelectItem,
  Pagination,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import { LuPackage, LuSearch, LuPencil, LuTrash2, LuEye, LuAlertTriangle, LuPlus, LuLayers, LuTag, LuFileSpreadsheet, LuRefreshCw } from "react-icons/lu";
import { FaBarcode } from "react-icons/fa6";
import { RiMoreFill } from "react-icons/ri";
import { DynamicBreadcrumbs } from "@/components";
import { useTenantAuthStore } from "@/modules/auth/store/tenantAuth.store";
import { useProductsStore } from "../../store/products/products.store";
import { useCategoriesStore } from "../../store/categories/categories.store";
import { useBrandsStore } from "../../store/brands/brands.store";
import { ProductExcelModal } from "./components/ProductExcelModal";
import { getImageUrl as getProductImageUrl } from "@/utils/image";
import { BarcodeScannerUpdateModal } from "./components/BarcodeScannerUpdateModal";
import { IProductResponse } from "@/interface";

export const IndexProducts = () => {
  const navigate = useNavigate();
  const token = useTenantAuthStore((state) => state.token);
  const can = useTenantAuthStore((state) => state.can);

  const canCreate = can("products:create");
  const canUpdate = can("products:update");
  const canDelete = can("products:delete");

  // Stores
  const products = useProductsStore((state) => state.products);
  const isLoading = useProductsStore((state) => state.isLoading);
  const getProducts = useProductsStore((state) => state.getProducts);
  const createProduct = useProductsStore((state) => state.createProduct);
  const updateProduct = useProductsStore((state) => state.updateProduct);
  const deleteProduct = useProductsStore((state) => state.deleteProduct);
  const deleteAllProducts = useProductsStore((state) => state.deleteAllProducts);

  const categories = useCategoriesStore((state) => state.categories);
  const getCategories = useCategoriesStore((state) => state.getCategories);

  const brands = useBrandsStore((state) => state.brands);
  const getBrands = useBrandsStore((state) => state.getBrands);

  // States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(15);

  // Delete modal state
  const [productToDelete, setProductToDelete] = useState<IProductResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState<boolean>(false);
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false);

  // Excel modal state
  const [isExcelModalOpen, setIsExcelModalOpen] = useState<boolean>(false);

  // Barcode scanner modal state
  const [productForBarcodeScan, setProductForBarcodeScan] = useState<IProductResponse | null>(null);

  const handleUpdateBarcode = async (productId: number | string, newBarcode: string) => {
    const prod = products.find((p) => p.id === productId);
    const success = await updateProduct(productId, {
      name: prod?.name,
      category_id: prod?.category_id || undefined,
      brand_id: prod?.brand_id || undefined,
      sku: prod?.sku || undefined,
      barcode: newBarcode,
    });
    if (success) {
      await getProducts(token || undefined);
    }
    return Boolean(success);
  };

  useEffect(() => {
    getProducts(token || undefined);
    if (categories.length === 0) getCategories(token || undefined);
    if (brands.length === 0) getBrands(token || undefined);
  }, []);

  const categoryFilterOptions = useMemo(() => [
    { id: "all", name: "Todas las categorías" },
    ...categories.map((c) => ({ id: String(c.id), name: c.full_path || c.name }))
  ], [categories]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let result = products;

    if (categoryFilter !== "all") {
      result = result.filter((p) => String(p.category_id) === categoryFilter);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((p) => {
        const name = p.name?.toLowerCase() || "";
        const slug = p.slug?.toLowerCase() || "";
        const sku = p.sku?.toLowerCase() || "";
        const barcode = p.barcode?.toLowerCase() || "";
        const cat = p.category?.toLowerCase() || "";
        const brand = p.brand?.toLowerCase() || "";
        return (
          name.includes(query) ||
          slug.includes(query) ||
          sku.includes(query) ||
          barcode.includes(query) ||
          cat.includes(query) ||
          brand.includes(query)
        );
      });
    }

    return result;
  }, [products, searchQuery, categoryFilter]);

  // Reset page to 1 when filters or rows per page change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, categoryFilter, rowsPerPage]);

  // Pagination calculation
  const pages = Math.ceil(filteredProducts.length / rowsPerPage) || 1;

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredProducts.slice(start, start + rowsPerPage);
  }, [page, filteredProducts, rowsPerPage]);

  const handleOpenCreate = () => {
    navigate("/products/create");
  };

  const handleOpenEdit = (product: IProductResponse) => {
    navigate(`/products/${product.id}/edit`);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete?.id) return;
    setIsDeleting(true);
    const success = await deleteProduct(productToDelete.id, token || undefined);
    setIsDeleting(false);
    if (success) {
      setProductToDelete(null);
    }
  };

  return (
    <div className="my-2 px-3 sm:px-6 max-w-[95rem] mx-auto w-full flex flex-col gap-4">
      {/* Breadcrumbs */}
      <DynamicBreadcrumbs title="Productos" />

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Productos
            </h1>
            <Chip size="sm" variant="flat" color="primary" className="font-semibold">
              {products.length} {products.length === 1 ? "producto" : "productos"}
            </Chip>
            {filteredProducts.length !== products.length && (
              <Chip size="sm" variant="flat" color="secondary" className="font-semibold">
                {filteredProducts.length} filtrados
              </Chip>
            )}
          </div>
          <p className="text-xs hidden sm:block sm:text-sm text-default-500 mt-0.5">
            Catálogo de inventario, códigos de barra, SKU y gestión de almacenes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Tooltip content="Recargar catálogo">
            <Button
              isIconOnly
              variant="flat"
              onPress={() => getProducts(token || undefined)}
              isLoading={isLoading}
              size="sm"
              aria-label="Recargar catálogo"
            >
              <LuRefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </Button>
          </Tooltip>
          <Button
            variant="flat"
            onPress={() => setIsExcelModalOpen(true)}
            startContent={<LuFileSpreadsheet size={16} />}
            className="font-semibold text-sm"
            size="sm"
            isDisabled={isLoading}
          >
            Importar / Exportar
          </Button>
          {canCreate && (
            <Button
              color="primary"
              onPress={handleOpenCreate}
              startContent={<LuPlus size={18} />}
              className="font-bold shadow-sm"
              size="sm"
            >
              <span className="block sm:hidden">Nuevo</span>
              <span className="hidden sm:block">Nuevo Producto</span>
            </Button>
          )}
          {canDelete && (
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Button
                  isIconOnly
                  variant="flat"
                  size="sm"
                  aria-label="Más opciones"
                  className="border border-default-200"
                >
                  <RiMoreFill className="text-base" />
                </Button>
              </DropdownTrigger>
              <DropdownMenu
                aria-label="Opciones avanzadas de productos"
                onAction={(key) => {
                  if (key === "delete-all") {
                    setIsDeleteAllOpen(true);
                  }
                }}
              >
                <DropdownItem
                  key="delete-all"
                  color="danger"
                  className="text-danger"
                  startContent={<LuTrash2 className="text-danger" size={16} />}
                  description={`Elimina todos los productos (${products.length})`}
                >
                  Eliminar todos los productos
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-1 items-center justify-between bg-content1">
        <Input
          placeholder="Buscar por nombre, SKU, código de barras o marca..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          isClearable
          size="sm"
          variant="bordered"
          className="w-full sm:max-w-md"
          startContent={<LuSearch className="text-default-400" size={16} />}
        />

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            size="sm"
            variant="bordered"
            aria-label="Filtrar por categoría"
            placeholder="Todas las categorías"
            selectedKeys={[categoryFilter]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              setCategoryFilter(selected || "all");
            }}
            className="w-full sm:w-56"
            startContent={<LuLayers className="text-default-400" size={14} />}
            items={categoryFilterOptions}
          >
            {(cat) => (
              <SelectItem key={cat.id} textValue={cat.name}>
                {cat.name}
              </SelectItem>
            )}
          </Select>

          {(searchQuery || categoryFilter !== "all") && (
            <Button
              size="sm"
              variant="flat"
              onPress={() => {
                setSearchQuery("");
                setCategoryFilter("all");
              }}
              className="text-xs text-default-600"
            >
              Restablecer
            </Button>
          )}
        </div>
      </div>

      {/* Table Section with Smart Loading Container */}
      <div className="w-full bg-content1 overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <Table
            aria-label="Tabla de productos con carga inteligente"
            removeWrapper
            className="min-w-[750px] border-separate border-spacing-0"
          >
            <TableHeader>
              <TableColumn className="bg-default-50 text-[11px] font-bold uppercase tracking-wider py-3.5 pl-4 border-b border-divider">
                PRODUCTO
              </TableColumn>
              <TableColumn className="bg-default-50 text-[11px] font-bold uppercase tracking-wider border-b border-divider">
                SKU
              </TableColumn>
              <TableColumn className="bg-default-50 text-[11px] font-bold uppercase tracking-wider border-b border-divider">
                CÓDIGO DE BARRAS
              </TableColumn>
              <TableColumn className="bg-default-50 text-[11px] font-bold uppercase tracking-wider border-b border-divider">
                CATEGORÍA
              </TableColumn>
              <TableColumn className="bg-default-50 text-[11px] font-bold uppercase tracking-wider border-b border-divider">
                MARCA
              </TableColumn>
              <TableColumn className="bg-default-50/95 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-right pr-4 sticky right-0 z-10 border-b border-divider border-l border-divider/60 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                ACCIONES
              </TableColumn>
            </TableHeader>

            <TableBody
              items={isLoading ? [] : paginatedProducts}
              isLoading={isLoading}
              loadingContent={
                <div className="space-y-3 w-full p-4">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="flex items-center gap-4 py-2.5 border-b border-divider/30 last:border-b-0">
                      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                      <div className="flex flex-col gap-2 flex-1">
                        <Skeleton className="w-2/5 h-3.5 rounded-lg" />
                        <Skeleton className="w-1/4 h-2.5 rounded-lg" />
                      </div>
                      <Skeleton className="w-16 h-6 rounded-lg" />
                      <Skeleton className="w-24 h-6 rounded-lg" />
                      <Skeleton className="w-20 h-5 rounded-lg" />
                      <Skeleton className="w-16 h-5 rounded-lg" />
                      <div className="flex gap-1 justify-end">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-8 h-8 rounded-lg" />
                      </div>
                    </div>
                  ))}
                </div>
              }
              emptyContent={
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-default-400">
                  <LuPackage size={38} className="opacity-40" />
                  <p className="text-sm font-medium">No se encontraron productos registrados</p>
                  {(searchQuery || categoryFilter !== "all") && (
                    <p className="text-xs text-default-400">
                      Prueba cambiando los términos de búsqueda o filtros.
                    </p>
                  )}
                </div>
              }
            >
              {(prod) => {
                const imageUrl = getProductImageUrl(prod.image || prod.thumbnail);
                return (
                  <TableRow key={prod.id} className="group hover:bg-default-50/60 transition-colors border-b border-divider/40 last:border-b-0">
                    {/* Producto (Imagen + Nombre + Slug) */}
                    <TableCell className="py-2.5 pl-4 border-b border-divider/40">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={imageUrl || undefined}
                          name={prod.name}
                          radius="lg"
                          size="md"
                          className="bg-default-100 text-default-500 shrink-0 border border-divider shadow-xs"
                          fallback={<LuPackage size={20} className="text-default-400" />}
                        />
                        <div className="flex flex-col min-w-0">
                          <span
                            onClick={() => navigate(`/products/${prod.id}`)}
                            className="font-bold text-sm text-foreground hover:text-primary cursor-pointer transition-colors truncate"
                          >
                            {prod.name}
                          </span>
                          <span className="text-[11px] font-mono text-default-400 truncate">
                            /{prod.slug}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* SKU */}
                    <TableCell className="py-2.5 border-b border-divider/40">
                      {prod.sku ? (
                        <Chip
                          size="sm"
                          variant="flat"
                          color="primary"
                          className="font-mono text-xs font-bold"
                        >
                          {prod.sku}
                        </Chip>
                      ) : (
                        <span className="text-xs text-default-400 italic">-</span>
                      )}
                    </TableCell>

                    {/* Código de barras - Clic para escanear y actualizar */}
                    <TableCell className="py-2.5 border-b border-divider/40">
                      <Tooltip content={canUpdate ? "Clic para escanear o cambiar código de barras" : "Código de barras"}>
                        <div
                          onClick={() => {
                            if (canUpdate) {
                              setProductForBarcodeScan(prod);
                            }
                          }}
                          className={`flex items-center gap-1.5 text-xs font-mono font-medium rounded-lg w-fit px-2 py-1 transition-all ${canUpdate ? "cursor-pointer hover:ring-2 hover:ring-primary/40 active:scale-95" : ""
                            } ${prod.barcode
                              ? "bg-default-100 text-default-800 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950/40"
                              : "bg-default-50 text-default-400 border border-dashed border-default-300 hover:border-primary hover:text-primary"
                            }`}
                        >
                          <FaBarcode size={13} className={prod.barcode ? "text-primary-600 dark:text-primary-400" : "text-default-400"} />
                          <span>{prod.barcode || "+ Asignar código"}</span>
                        </div>
                      </Tooltip>
                    </TableCell>

                    {/* Categoría */}
                    <TableCell className="py-2.5 border-b border-divider/40">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: prod.color || "#6366f1" }}
                        />
                        <span className="text-xs font-medium text-default-700 truncate max-w-[180px]">
                          {prod.category_path || prod.category}
                        </span>
                      </div>
                    </TableCell>

                    {/* Marca */}
                    <TableCell className="py-2.5 border-b border-divider/40">
                      <Chip size="sm" variant="flat" color="default" className="text-xs">
                        {prod.brand || "DESCONOCIDO"}
                      </Chip>
                    </TableCell>

                    {/* Acciones (Fijo / Sticky a la derecha) */}
                    <TableCell className="py-2.5 pr-4 text-right sticky right-0 z-10 bg-content1 group-hover:bg-default-50/90 transition-colors border-b border-divider/40 border-l border-divider/60 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.3)]">
                      <div className="flex items-center justify-end gap-1">
                        {/* Ver Detalle */}
                        <Tooltip content="Ver ficha completa y galería">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="primary"
                            onPress={() => navigate(`/products/${prod.id}`)}
                            aria-label="Ver producto"
                          >
                            <LuEye size={16} />
                          </Button>
                        </Tooltip>

                        {/* Editar */}
                        {canUpdate && (
                          <Tooltip content="Editar producto">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="secondary"
                              onPress={() => handleOpenEdit(prod)}
                              aria-label="Editar producto"
                            >
                              <LuPencil size={16} />
                            </Button>
                          </Tooltip>
                        )}

                        {/* Eliminar */}
                        {canDelete && (
                          <Tooltip content="Eliminar producto" color="danger">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => setProductToDelete(prod)}
                              aria-label="Eliminar producto"
                            >
                              <LuTrash2 size={16} />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }}
            </TableBody>
          </Table>
        </div>

        {/* Bottom Pagination & Smart Loading Controls */}
        <div className="px-4 py-3 border-t border-divider flex flex-col sm:flex-row items-center justify-between gap-3 bg-content1">
          {/* Contador de elementos */}
          <div className="text-xs text-default-500 font-medium">
            {filteredProducts.length === 0 ? (
              "0 productos encontrados"
            ) : (
              <>
                Mostrando{" "}
                <span className="font-semibold text-foreground">
                  {(page - 1) * rowsPerPage + 1}
                </span>{" "}
                a{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(page * rowsPerPage, filteredProducts.length)}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-foreground">
                  {filteredProducts.length}
                </span>{" "}
                {filteredProducts.length === 1 ? "producto" : "productos"}
                {filteredProducts.length !== products.length && (
                  <span className="text-default-400 ml-1">
                    (filtrados de {products.length} en total)
                  </span>
                )}
              </>
            )}
          </div>

          {/* Componente de Paginación */}
          {pages > 1 && (
            <Pagination
              isCompact
              showControls
              showShadow
              color="primary"
              page={page}
              total={pages}
              onChange={(newPage) => setPage(newPage)}
              classNames={{
                cursor: "font-bold shadow-sm",
              }}
            />
          )}

          {/* Selector de Filas por Página */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-default-500 font-medium">Filas por pág:</span>
            <select
              aria-label="Filas por página"
              className="bg-default-100 hover:bg-default-200 text-default-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 border border-divider outline-none cursor-pointer transition-colors"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>


      {/* Modal de Confirmación de Eliminación */}
      <Modal
        isOpen={productToDelete !== null}
        onClose={() => setProductToDelete(null)}
        size="sm"
        placement="center"
        backdrop="blur"
        classNames={{
          base: "bg-content1 border border-divider shadow-xl rounded-2xl mx-2 sm:mx-auto max-w-sm",
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex items-center gap-2 text-danger">
                <LuAlertTriangle size={20} />
                <span className="text-base font-bold">Eliminar Producto</span>
              </ModalHeader>
              <ModalBody className="py-2">
                <p className="text-sm text-default-600">
                  ¿Estás seguro de que deseas eliminar permanentemente el producto{" "}
                  <strong className="text-foreground">{productToDelete?.name}</strong>?
                </p>
                <p className="text-xs text-default-400 mt-1">
                  Se eliminarán también las imágenes de la galería asociadas a este producto.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setProductToDelete(null)}
                  isDisabled={isDeleting}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  isLoading={isDeleting}
                  onPress={handleConfirmDelete}
                  className="font-bold"
                >
                  Sí, eliminar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      {/* Modal Excel: Importar / Exportar */}
      <ProductExcelModal
        isOpen={isExcelModalOpen}
        onClose={() => {
          setIsExcelModalOpen(false);
          getProducts(token || undefined);
        }}
        totalProducts={products.length}
      />

      {/* Modal de Escaneo y Asignación de Código de Barras */}
      <BarcodeScannerUpdateModal
        isOpen={productForBarcodeScan !== null}
        onClose={() => setProductForBarcodeScan(null)}
        product={productForBarcodeScan}
        onUpdateBarcode={handleUpdateBarcode}
      />

      {/* Modal Confirmar Eliminar Todos los Productos */}
      <Modal
        isOpen={isDeleteAllOpen}
        onClose={() => !isDeletingAll && setIsDeleteAllOpen(false)}
        size="md"
      >
        <ModalContent>
          <ModalHeader className="flex gap-2 items-center text-danger">
            <LuAlertTriangle className="text-danger text-xl" />
            <span className="text-base font-bold">Eliminar Todos los Productos</span>
          </ModalHeader>
          <ModalBody className="py-2">
            <p className="text-sm font-medium text-foreground">
              ¿Estás completamente seguro de que deseas eliminar <strong className="text-danger">TODOS los {products.length} productos</strong> del catálogo?
            </p>
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-3 text-xs text-danger-700 dark:text-danger-300 flex flex-col gap-1.5 mt-2">
              <p className="font-semibold flex items-center gap-1.5">
                <LuAlertTriangle className="text-sm" /> Acción irreversible:
              </p>
              <ul className="list-disc list-inside space-y-1 text-default-600 dark:text-default-400">
                <li>Se eliminarán todos los productos y códigos de barra del catálogo.</li>
                <li>Se vaciarán las existencias en almacén y tiendas vinculadas.</li>
                <li>Se eliminarán las fotos de la galería del servidor.</li>
              </ul>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              size="sm"
              variant="flat"
              onPress={() => setIsDeleteAllOpen(false)}
              isDisabled={isDeletingAll}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              color="danger"
              isLoading={isDeletingAll}
              onPress={async () => {
                setIsDeletingAll(true);
                const ok = await deleteAllProducts(token || undefined);
                setIsDeletingAll(false);
                if (ok) {
                  setIsDeleteAllOpen(false);
                }
              }}
              className="font-bold"
            >
              Sí, eliminar todos los productos
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
