import type { Area } from "react-easy-crop";

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida que el archivo sea una imagen válida y que no supere el tamaño máximo indicado (por defecto 5 MB).
 */
export const validateImageFile = (
  file: File | null | undefined,
  maxSizeMB: number = 5
): ImageValidationResult => {
  if (!file) {
    return { valid: false, error: "No se seleccionó ningún archivo." };
  }

  // 1. Validar que sea un archivo de tipo imagen
  const isImageMime = file.type.startsWith("image/");
  const isImageExt = /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name);

  if (!isImageMime && !isImageExt) {
    return {
      valid: false,
      error: "Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).",
    };
  }

  // 2. Validar que no supere el tamaño máximo (5 MB por defecto)
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `La imagen seleccionada pesa ${sizeInMB} MB, superando el límite permitido de ${maxSizeMB} MB.`,
    };
  }

  return { valid: true };
};

/**
 * Crea un elemento HTMLImageElement a partir de una URL o Base64.
 */
export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

/**
 * Genera el recorte cuadrado (o con la proporción especificada) en formato Blob y Base64.
 */
export const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
  outputType: string = "image/jpeg",
  quality: number = 0.92
): Promise<{ blob: Blob; base64: string }> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("No se pudo obtener el contexto 2D del canvas");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Fondo blanco limpio para imágenes JPEG (evita fondos negros si hay transparencias)
  if (outputType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Error al convertir canvas a Blob"));
          return;
        }
        const base64 = canvas.toDataURL(outputType, quality);
        resolve({ blob, base64 });
      },
      outputType,
      quality
    );
  });
};
