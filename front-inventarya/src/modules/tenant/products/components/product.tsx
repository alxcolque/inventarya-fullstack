
import { useEffect, useState } from "react"

import {
  Button,
  Image,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@nextui-org/react";
import { motion, AnimatePresence, wrap } from "framer-motion";
import clsx from "clsx";
import { useProductsStore } from "../store/products/products.store";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { getImageUrl } from "@/utils/image";

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    };
  },
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    };
  },
};
const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};
interface Props {
  slug: string;
  token: string;
}

export const Product = ({ slug, token }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const [product, setProduct] = useState<any>({});
  /* Cannot read properties of undefined (reading 'length') */
  const [productImages, setProductImages] = useState<any[]>([]);
  const [productInventoryStore, setProductInventoryStore] = useState<any[]>([]);
  const [productInventoryWarehouse, setProductInventoryWarehouse] = useState<any[]>([]);
  //const data = useProductsStore((state) => state.product);
  const getProduct = useProductsStore((state) => state.getProductBySlug);
  const [[page, direction], setPage] = useState([0, 0]);

  const handleGetProduct = async () => {
    setIsLoading(true);
    try {
      if (slug && token) {
        const response = await getProduct(slug, token);
        if (response) {
          setProduct(response.product || {});
          setProductImages(response.productImages || []);
          setProductInventoryStore(response.productInventoryStore || []);
          setProductInventoryWarehouse(response.productInventoryWarehouse || []);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const imageIndex = productImages.length > 0 ? wrap(0, productImages.length, page) : 0;
  const paginate = (newDirection: number) => {
    if (productImages.length <= 1) return;
    setPage([page + newDirection, newDirection]);
  };


  useEffect(() => {
    handleGetProduct();
  }, []);

  //console.log(productInventoryWarehouse);
  return (
    <div>
      {/* Dos columnas */}
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="flex flex-wrap xl:flex-nowrap gap-4 w-full">

          <div className="flex flex-col">
            <div className="flex flex-col gap-2 mb-2">
              <img
                src={getImageUrl(product?.thumbnail || product?.image) || "https://placehold.co/400x400?text=Sin+Imagen"}
                alt={product?.name}
                className="w-[400px] h-[400px] object-cover"
                style={{
                  borderRadius: "1rem",
                }}
              />
            </div>
            <div className="flex flex-col gap-4 justify-center items-center w-full h-full">
              {/* Main Image Carousel */}
              {productImages.length > 0 && (
                <>
                  <div className="relative flex h-[400px] w-full max-w-4xl items-center overflow-hidden rounded-xl">
                    <AnimatePresence initial={false} custom={direction}>
                      <motion.div
                        key={page}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                          x: { type: "spring", stiffness: 300, damping: 30 },
                          opacity: { duration: 0.2 },
                        }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={1}
                        onDragEnd={(
                          e,
                          {
                            offset,
                            velocity,
                          }: { offset: { x: number }; velocity: { x: number } }
                        ) => {
                          const swipe = swipePower(offset.x, velocity.x);
                          console.log(e);
                          if (swipe < -swipeConfidenceThreshold) {
                            paginate(1);
                          } else if (swipe > swipeConfidenceThreshold) {
                            paginate(-1);
                          }
                        }}
                        className="absolute w-full h-full"
                      >
                        {productImages.length > 0 && (
                          <Image
                            removeWrapper
                            alt={`Product Image ${imageIndex}`}
                            className="object-cover w-full h-full"
                            src={getImageUrl(productImages[imageIndex]?.image) || ""}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Arrows */}
                    <Button
                      className="hidden absolute left-5 top-1/2 z-10 w-12 min-w-0 h-12 md:flex"
                      radius="full"
                      onPress={() => paginate(-1)}
                    >
                      <svg
                        width="12"
                        height="18"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M11 1 3 9l8 8"
                          stroke="#1D2026"
                          strokeWidth="3"
                          fill="none"
                          fillRule="evenodd"
                        />
                      </svg>
                    </Button>

                    <Button
                      className="hidden absolute right-5 top-1/2 z-10 w-12 min-w-0 h-12 md:flex"
                      radius="full"
                      onPress={() => paginate(1)}
                    >
                      <svg
                        width="13"
                        height="18"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="m2 1 8 8-8 8"
                          stroke="#1D2026"
                          strokeWidth="3"
                          fill="none"
                          fillRule="evenodd"
                        />
                      </svg>
                    </Button>
                  </div>


                  {/* Thumbnails Carousel */}
                  <div className="flex overflow-x-auto gap-2 px-1 py-2 w-full max-w-4xl scrollbar-hide">
                    {productImages.map((img: any, index: number) => (
                      <button
                        key={index}
                        onClick={() => setPage([index, index - imageIndex])}
                        className={clsx(
                          "h-20 w-24 flex-shrink-0 overflow-hidden rounded-md transition-all duration-300",
                          {
                            "ring-2 ring-orange-500": index === imageIndex,
                          }
                        )}
                      >
                        <div className="relative">
                          <Image
                            removeWrapper
                            alt={`Thumbnail ${index}`}
                            src={getImageUrl(img.image) || ""}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1">
                  <h3 className="text-2xl font-bold uppercase">{product?.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  <h3 className="text-lg font-medium">Descripción: </h3>
                  <p>{product?.description}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <h3 className="text-lg font-medium">Categoría: </h3>
                  <p className="font-semibold text-primary">
                    {product?.category_path || product?.category}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <h3 className="text-lg font-medium">Marca: </h3>
                  <p>{product?.brand}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold uppercase">Stock en la Bodega</h3>
                <div className="flex flex-wrap gap-1">

                  <Table aria-label="Stock bodega">
                    <TableHeader>
                      <TableColumn>Stock</TableColumn>
                      <TableColumn>Precio</TableColumn>
                      <TableColumn>Unidad</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {productInventoryWarehouse.map((inventory: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{inventory.stock_quantity}</TableCell>
                          <TableCell><PriceDisplay amount={inventory.price} /></TableCell>
                          <TableCell>{inventory.unit}</TableCell>
                        </TableRow>
                      ))}

                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-bold uppercase">Tiendas Distribuidas</h3>
                <div className="flex flex-col wrap gap-1">


                  <Table aria-label="Tiendas Distribuidas">
                    <TableHeader>
                      <TableColumn>Tienda</TableColumn>
                      <TableColumn>Stock</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {productInventoryStore.map((inventory: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{inventory.store}</TableCell>
                          <TableCell>{inventory.stock_quantity}</TableCell>
                        </TableRow>
                      ))}

                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          </div>

        </div>
      )}
    </div>
  );
}