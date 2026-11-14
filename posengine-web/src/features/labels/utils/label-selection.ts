import type { LabelProduct, SelectedLabelProduct } from "../types/label.types"

export const MAX_LABELS_PER_PRODUCT = 200

export function parseLabelQuantity(value: number): number | null {
  return Number.isInteger(value) && value > 0 && value <= MAX_LABELS_PER_PRODUCT ? value : null
}

export function parseLabelQuantityDraft(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  return parseLabelQuantity(Number(value))
}

export function addSelectedProduct(
  selected: SelectedLabelProduct[],
  product: LabelProduct,
  quantity: number,
): SelectedLabelProduct[] {
  const validQuantity = parseLabelQuantity(quantity)
  if (validQuantity === null) return selected

  const existing = selected.find((item) => item.id === product.id)
  if (!existing) return [...selected, { ...product, quantity: validQuantity }]

  const nextQuantity = Math.min(MAX_LABELS_PER_PRODUCT, existing.quantity + validQuantity)
  return selected.map((item) => item.id === product.id ? { ...item, quantity: nextQuantity } : item)
}

export function updateSelectedProductQuantity(
  selected: SelectedLabelProduct[],
  productId: string,
  quantity: number,
): SelectedLabelProduct[] {
  const validQuantity = parseLabelQuantity(quantity)
  if (validQuantity === null) return selected
  return selected.map((item) => item.id === productId ? { ...item, quantity: validQuantity } : item)
}

export function removeSelectedProduct(selected: SelectedLabelProduct[], productId: string): SelectedLabelProduct[] {
  return selected.filter((item) => item.id !== productId)
}
