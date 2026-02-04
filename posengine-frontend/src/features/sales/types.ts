import type { CartItem } from "@/src/shared/types"

export type PaymentMethod = "cash" | "card" | "transfer"

export interface SaleFormData {
  items: CartItem[]
  paymentMethod: PaymentMethod
  total: number
}
