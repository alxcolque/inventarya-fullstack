export interface SiatOption {
  key: string;
  value: number;
  label: string;
  shortLabel: string;
  description?: string;
}

export const SIAT_ENVIRONMENTS: SiatOption[] = [
  {
    key: "2",
    value: 2,
    label: "Pruebas / Piloto (Ambiente de Pruebas SIN)",
    shortLabel: "Pruebas / Piloto",
    description: "Para pruebas locales y homologación sin efectos tributarios",
  },
  {
    key: "1",
    value: 1,
    label: "Producción (Ambiente Oficial SIN)",
    shortLabel: "Producción",
    description: "Ambiente oficial de facturación con validez fiscal",
  },
];

export const SIAT_MODALITIES: SiatOption[] = [
  {
    key: "1",
    value: 1,
    label: "1 - Electrónica en Línea",
    shortLabel: "Electrónica en Línea",
    description: "Emisión firmada digitalmente con envío inmediato a SIN",
  },
  {
    key: "2",
    value: 2,
    label: "2 - Computarizada en Línea",
    shortLabel: "Computarizada en Línea",
    description: "Emisión asistida con código de sistema autorizado por SIN",
  },
];
