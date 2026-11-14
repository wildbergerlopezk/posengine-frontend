import type { SelectedLabelProduct } from "../types/label.types"

export function sanitizeLabelDraftProducts(value: unknown): SelectedLabelProduct[] {
  if (!Array.isArray(value)) return []

  const selected = new Map<string, SelectedLabelProduct>()
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue
    const product = candidate as Partial<SelectedLabelProduct>
    if (typeof product.id !== "string" || !product.id || typeof product.name !== "string" || !product.name) continue
    if (!Number.isInteger(product.quantity) || (product.quantity as number) < 1) continue

    const safeProduct: SelectedLabelProduct = {
      id: product.id,
      name: product.name,
      quantity: Math.min(200, product.quantity as number),
      price: typeof product.price === "number" && Number.isFinite(product.price) ? product.price : 0,
      ...(typeof product.sku === "string" && product.sku ? { sku: product.sku } : {}),
      ...(typeof product.barcode === "string" && product.barcode ? { barcode: product.barcode } : {}),
      ...(typeof product.imageUrl === "string" && product.imageUrl ? { imageUrl: product.imageUrl } : {}),
      ...(typeof product.description === "string" && product.description ? { description: product.description } : {}),
    }

    const existing = selected.get(safeProduct.id)
    selected.set(safeProduct.id, existing
      ? { ...safeProduct, quantity: Math.min(200, existing.quantity + safeProduct.quantity) }
      : safeProduct)
  }

  return [...selected.values()]
}

export function labelDraftScopeKey(userId: string, tenantId: string | null | undefined): string {
  return JSON.stringify([tenantId || null, userId])
}

export function matchesLabelDraftScope(savedScope: unknown, currentScope: string): boolean {
  return savedScope === currentScope
}
