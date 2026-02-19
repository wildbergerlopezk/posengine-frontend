"use client"

import { create } from "zustand"
import type { CartItem, Product } from "@/src/shared/types"

export type Currency = "GS" | "USD" | "BRL"

interface CartState {
  items: CartItem[]
  currency: Currency
  exchangeRates: Record<Currency, number>
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
  setCurrency: (currency: Currency) => void
  getTotalInCurrency: (currency: Currency) => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  currency: "GS",
  exchangeRates: {
    GS: 1,
    USD: 7300,
    BRL: 1350,
  },
  addItem: (product) =>
    set((state) => {
      const existing = state.items.find((item) => item.product.id === product.id)
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        }
      }
      return { items: [...state.items, { product, quantity: 1 }] }
    }),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.product.id !== productId),
    })),
  updateQuantity: (productId, quantity) =>
    set((state) => ({
      items:
        quantity <= 0
          ? state.items.filter((item) => item.product.id !== productId)
          : state.items.map((item) => (item.product.id === productId ? { ...item, quantity } : item)),
    })),
  clearCart: () => set({ items: [] }),
  getTotal: () => get().items.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0),
  getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
  setCurrency: (currency) => set({ currency }),
  getTotalInCurrency: (currency) => {
    const total = get().getTotal()
    const rate = get().exchangeRates[currency]
    return total / rate
  },
}))