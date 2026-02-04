"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  ShoppingCart,
  Check,
} from "lucide-react"
import { Header } from "@/src/shared/components/Header"
import { mockProducts, mockCategories } from "@/src/shared/api/mock-data"
import { useCartStore } from "../store/cart.store"
import { useAuthStore } from "@/src/features/auth/store/auth.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import type { PaymentMethod } from "../types"
import styles from "./SalesPage.module.css"

export function SalesPage() {
  const { tenant } = useAuthStore()
  const { items, addItem, removeItem, updateQuantity, clearCart, getTotal } = useCartStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [barcodeInput, setBarcodeInput] = useState("")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [saleComplete, setSaleComplete] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement>(null)

  const parentCategories = mockCategories.filter((c) => !c.parentId)

  const filteredProducts = mockProducts.filter((product) => {
    const matchesSearch =
      searchQuery === "" ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.includes(searchQuery)
    return matchesSearch && product.isActive
  })

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const product = mockProducts.find((p) => p.barcode === barcodeInput)
    if (product) {
      addItem(product)
      setBarcodeInput("")
    }
    barcodeInputRef.current?.focus()
  }

  const handleCompleteSale = () => {
    setSaleComplete(true)
    setTimeout(() => {
      clearCart()
      setSaleComplete(false)
      setShowPaymentModal(false)
    }, 2000)
  }

  useEffect(() => {
    barcodeInputRef.current?.focus()
  }, [])

  const total = getTotal()

  return (
    <div className={styles.page}>
      <Header title="Punto de Venta" />

      <div className={styles.container}>
        <div className={styles.grid}>
          {/* Left Panel - Product Search & Selection */}
          <div className={styles.leftPanel}>
            {/* Search Bars */}
            <div className={styles.searchRow}>
              <div className={styles.searchWrapper}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  placeholder="Buscar por nombre o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <form onSubmit={handleBarcodeSubmit} className={styles.barcodeForm}>
                <div className={styles.searchWrapper}>
                  <Barcode size={16} className={styles.searchIcon} />
                  <input
                    ref={barcodeInputRef}
                    placeholder="Escanear código de barras"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className={styles.barcodeInput}
                  />
                </div>
                <button type="submit" className={styles.addButton}>
                  Agregar
                </button>
              </form>
            </div>

            {/* Category Tabs */}
            <div className={styles.categoryTabs}>
              <button
                className={`${styles.categoryButton} ${searchQuery === "" ? styles.categoryButtonActive : ""}`}
                onClick={() => setSearchQuery("")}
              >
                Todos
              </button>
              {parentCategories.map((category) => (
                <button
                  key={category.id}
                  className={styles.categoryButton}
                  onClick={() => setSearchQuery(category.name)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className={styles.productGrid}>
              {filteredProducts.map((product) => (
                <button key={product.id} onClick={() => addItem(product)} className={styles.productCard}>
                  <div className={styles.productImage}>
                    <ShoppingCart size={24} />
                  </div>
                  <span className={styles.productName}>{product.name}</span>
                  <span className={styles.productStock}>Stock: {product.stock}</span>
                  <span className={styles.productPrice}>{formatCurrency(product.salePrice, tenant?.currency)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel - Cart */}
          <div>
            <div className={styles.cartCard}>
              <div className={styles.cartHeader}>
                <div className={styles.cartTitle}>
                  <ShoppingCart size={20} />
                  Carrito
                </div>
                {items.length > 0 && (
                  <button className={styles.clearButton} onClick={clearCart}>
                    <Trash2 size={16} />
                    Vaciar
                  </button>
                )}
              </div>

              <div className={styles.cartContent}>
                {items.length === 0 ? (
                  <div className={styles.emptyCart}>
                    <ShoppingCart size={48} className={styles.emptyCartIcon} />
                    <p>El carrito está vacío</p>
                    <p>Escanea o selecciona productos</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.cartItems}>
                      {items.map((item) => (
                        <div key={item.product.id} className={styles.cartItem}>
                          <div className={styles.cartItemInfo}>
                            <p className={styles.cartItemName}>{item.product.name}</p>
                            <p className={styles.cartItemPrice}>
                              {formatCurrency(item.product.salePrice, tenant?.currency)} c/u
                            </p>
                          </div>
                          <div className={styles.cartItemActions}>
                            <button
                              className={styles.quantityButton}
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            >
                              <Minus size={12} />
                            </button>
                            <span className={styles.quantity}>{item.quantity}</span>
                            <button
                              className={styles.quantityButton}
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            >
                              <Plus size={12} />
                            </button>
                            <button className={styles.removeButton} onClick={() => removeItem(item.product.id)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={styles.cartTotal}>
                      <span>Total</span>
                      <span className={styles.cartTotalValue}>{formatCurrency(total, tenant?.currency)}</span>
                    </div>

                    <button className={styles.checkoutButton} onClick={() => setShowPaymentModal(true)}>
                      Cobrar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            {saleComplete ? (
              <div className={styles.successState}>
                <div className={styles.successIcon}>
                  <Check size={32} />
                </div>
                <h2 className={styles.successTitle}>Venta completada</h2>
                <p className={styles.successDescription}>La venta se ha registrado correctamente</p>
              </div>
            ) : (
              <>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>Finalizar venta</h2>
                  <p className={styles.modalDescription}>Total a cobrar: {formatCurrency(total, tenant?.currency)}</p>
                </div>

                <div className={styles.modalContent}>
                  <p className={styles.paymentLabel}>Método de pago</p>
                  <div className={styles.paymentOptions}>
                    <button
                      className={`${styles.paymentOption} ${paymentMethod === "cash" ? styles.paymentOptionActive : ""}`}
                      onClick={() => setPaymentMethod("cash")}
                    >
                      <Banknote size={24} />
                      <span className={styles.paymentOptionLabel}>Efectivo</span>
                    </button>
                    <button
                      className={`${styles.paymentOption} ${paymentMethod === "card" ? styles.paymentOptionActive : ""}`}
                      onClick={() => setPaymentMethod("card")}
                    >
                      <CreditCard size={24} />
                      <span className={styles.paymentOptionLabel}>Tarjeta</span>
                    </button>
                    <button
                      className={`${styles.paymentOption} ${paymentMethod === "transfer" ? styles.paymentOptionActive : ""}`}
                      onClick={() => setPaymentMethod("transfer")}
                    >
                      <ArrowRightLeft size={24} />
                      <span className={styles.paymentOptionLabel}>Transfer.</span>
                    </button>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button className={styles.cancelButton} onClick={() => setShowPaymentModal(false)}>
                    Cancelar
                  </button>
                  <button className={styles.confirmButton} onClick={handleCompleteSale}>
                    Confirmar venta
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
