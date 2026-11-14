import type { LabelFormat } from "../types/label.types"

export const LABEL_FORMATS: LabelFormat[] = [
  {
    id: "small",
    name: "Pequeña",
    widthMm: 50,
    heightMm: 20,
    // 50 mm minus 0.5 mm of borders and 2.4 mm of horizontal padding.
    barcodeAvailableWidthMm: 47.1,
    detail: "Productos individuales y bolsas pequeñas",
  },
  {
    id: "large",
    name: "Grande",
    widthMm: 90,
    heightMm: 30,
    // Inner width minus the 20 mm image and 1.2 mm gap.
    barcodeAvailableWidthMm: 65.1,
    detail: "Cajas y repuestos",
  },
]
