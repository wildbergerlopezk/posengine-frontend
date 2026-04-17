"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Search,
  Barcode,
  Trash2,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  ShoppingCart,
  Check,
  X,
  AlertCircle,
} from "lucide-react"
import { Header } from "@/src/shared/components/Header"
import { mockProducts, mockCategories } from "@/src/shared/api/mock-data"
import { useCartStore, type Currency } from "../store/cart.store"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"
import type { PaymentMethod } from "../types"
import styles from "./SalesPage.module.css"

export function SalesPage() {
  const { items, addItem, removeItem, updateQuantity, clearCart, getTotal, currency, setCurrency, getTotalInCurrency } = useCartStore()
  const [showProductModal, setShowProductModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [barcodeInput, setBarcodeInput] = useState("")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [saleComplete, setSaleComplete] = useState(false)
  const [selectedProductIndex, setSelectedProductIndex] = useState(0)
  const [selectedRowIndex, setSelectedRowIndex] = useState(0)
  const [editingQuantity, setEditingQuantity] = useState(false)
  const [quantityInput, setQuantityInput] = useState("")
  const [confirmModalSelectedButton, setConfirmModalSelectedButton] = useState<"accept" | "cancel">("accept")
  const [paymentModalSelectedButton, setPaymentModalSelectedButton] = useState<"cancel" | "confirm">("confirm")
  
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const confirmAcceptRef = useRef<HTMLButtonElement>(null)
  const confirmCancelRef = useRef<HTMLButtonElement>(null)
  const paymentConfirmRef = useRef<HTMLButtonElement>(null)
  const paymentCancelRef = useRef<HTMLButtonElement>(null)

  const parentCategories = mockCategories.filter((c) => !c.parentId)

  const filteredProducts = mockProducts.filter((product) => {
    const matchesSearch =
      searchQuery === "" ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.includes(searchQuery)
    return matchesSearch && product.isActive
  })

  // Manejar teclas globales
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // F2 - Abrir búsqueda de productos
      if (e.key === "F2") {
        e.preventDefault()
        if (!showProductModal && !showPaymentModal && !showConfirmModal) {
          setShowProductModal(true)
          setSelectedProductIndex(0)
        }
      }

      // F12 - Finalizar venta
      if (e.key === "F12") {
        e.preventDefault()
        if (items.length > 0 && !showProductModal && !showPaymentModal && !showConfirmModal) {
          setShowConfirmModal(true)
          setConfirmModalSelectedButton("accept")
        }
      }

      // Ctrl+E - Eliminar producto seleccionado
      if (e.ctrlKey && e.key === "e") {
        e.preventDefault()
        if (items.length > 0 && !showProductModal && !showPaymentModal && !showConfirmModal && !editingQuantity) {
          const selectedItem = items[selectedRowIndex]
          if (selectedItem) {
            removeItem(selectedItem.product.id)
            if (selectedRowIndex >= items.length - 1) {
              setSelectedRowIndex(Math.max(0, items.length - 2))
            }
          }
        }
      }

      // Flechas arriba/abajo para navegar en la tabla
      if (!showProductModal && !showPaymentModal && !showConfirmModal && !editingQuantity && items.length > 0) {
        if (e.key === "ArrowUp") {
          e.preventDefault()
          setSelectedRowIndex(prev => Math.max(0, prev - 1))
        }
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSelectedRowIndex(prev => Math.min(items.length - 1, prev + 1))
        }
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  }, [items, selectedRowIndex, showProductModal, showPaymentModal, showConfirmModal, editingQuantity, removeItem])

  // Manejar navegación en modal de confirmación
  useEffect(() => {
    if (!showConfirmModal) return

    const handleConfirmModalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault()
        setConfirmModalSelectedButton(prev => prev === "accept" ? "cancel" : "accept")
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (confirmModalSelectedButton === "accept") {
          handleCompleteSale()
        } else {
          setShowConfirmModal(false)
          barcodeInputRef.current?.focus()
        }
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowConfirmModal(false)
        barcodeInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleConfirmModalKeyDown)
    return () => window.removeEventListener("keydown", handleConfirmModalKeyDown)
  }, [showConfirmModal, confirmModalSelectedButton])

  // Manejar navegación en modal de pago
  useEffect(() => {
    if (!showPaymentModal || saleComplete) return

    const handlePaymentModalKeyDown = (e: KeyboardEvent) => {
      // Navegación entre métodos de pago
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        if (paymentMethod === "card") setPaymentMethod("cash")
        else if (paymentMethod === "transfer") setPaymentMethod("card")
      }
      if (e.key === "ArrowRight") {
        e.preventDefault()
        if (paymentMethod === "cash") setPaymentMethod("card")
        else if (paymentMethod === "card") setPaymentMethod("transfer")
      }
      
      // Navegación entre botones de cancelar/confirmar
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault()
        setPaymentModalSelectedButton(prev => prev === "confirm" ? "cancel" : "confirm")
      }
      
      if (e.key === "Enter") {
        e.preventDefault()
        if (paymentModalSelectedButton === "confirm") {
          handleFinalizeSale()
        } else {
          setShowPaymentModal(false)
          barcodeInputRef.current?.focus()
        }
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setShowPaymentModal(false)
        barcodeInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handlePaymentModalKeyDown)
    return () => window.removeEventListener("keydown", handlePaymentModalKeyDown)
  }, [showPaymentModal, saleComplete, paymentMethod, paymentModalSelectedButton])

  // Enfocar input de cantidad cuando se activa edición
  useEffect(() => {
    if (editingQuantity && quantityInputRef.current) {
      quantityInputRef.current.focus()
      quantityInputRef.current.select()
    }
  }, [editingQuantity])

  // Enfocar botón correcto en modal de confirmación
  useEffect(() => {
    if (showConfirmModal) {
      setTimeout(() => {
        if (confirmModalSelectedButton === "accept") {
          confirmAcceptRef.current?.focus()
        } else {
          confirmCancelRef.current?.focus()
        }
      }, 100)
    }
  }, [showConfirmModal, confirmModalSelectedButton])

  // Enfocar botón correcto en modal de pago
  useEffect(() => {
    if (showPaymentModal && !saleComplete) {
      setTimeout(() => {
        if (paymentModalSelectedButton === "confirm") {
          paymentConfirmRef.current?.focus()
        } else {
          paymentCancelRef.current?.focus()
        }
      }, 100)
    }
  }, [showPaymentModal, paymentModalSelectedButton, saleComplete])

  // Resetear índice seleccionado cuando cambian los items
  useEffect(() => {
    if (selectedRowIndex >= items.length && items.length > 0) {
      setSelectedRowIndex(items.length - 1)
    }
  }, [items.length, selectedRowIndex])

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const product = mockProducts.find((p) => p.barcode === barcodeInput)
    if (product) {
      addItem(product)
      setBarcodeInput("")
      
      // Activar edición de cantidad para cada producto agregado
      setTimeout(() => {
        setSelectedRowIndex(items.length)
        setEditingQuantity(true)
        setQuantityInput("1")
      }, 50)
    }
  }

  const handleAddProduct = (product: any) => {
    addItem(product)
    setShowProductModal(false)
    setSearchQuery("")
    
    // Activar edición de cantidad para cada producto agregado
    setTimeout(() => {
      setSelectedRowIndex(items.length)
      setEditingQuantity(true)
      setQuantityInput("1")
    }, 50)
  }

  const handleQuantitySubmit = () => {
    const selectedItem = items[selectedRowIndex]
    if (selectedItem && quantityInput) {
      const newQuantity = parseInt(quantityInput)
      if (newQuantity > 0) {
        updateQuantity(selectedItem.product.id, newQuantity)
      }
    }
    setEditingQuantity(false)
    setQuantityInput("")
    barcodeInputRef.current?.focus()
  }

  const handleCompleteSale = () => {
    setShowConfirmModal(false)
    setShowPaymentModal(true)
    setPaymentModalSelectedButton("confirm")
  }

  const handleFinalizeSale = () => {
    setSaleComplete(true)
    setTimeout(() => {
      clearCart()
      setSaleComplete(false)
      setShowPaymentModal(false)
      setSelectedRowIndex(0)
      barcodeInputRef.current?.focus()
    }, 500)
  }

  // Manejar navegación en modal de productos
  const handleProductModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedProductIndex(prev => Math.min(filteredProducts.length - 1, prev + 1))
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedProductIndex(prev => Math.max(0, prev - 1))
    }
    if (e.key === "Enter") {
      e.preventDefault()
      const selectedProduct = filteredProducts[selectedProductIndex]
      if (selectedProduct) {
        handleAddProduct(selectedProduct)
      }
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setShowProductModal(false)
      setSearchQuery("")
      barcodeInputRef.current?.focus()
    }
  }

  // Manejar click en cantidad (solo con mouse)
  const handleQuantityClick = (index: number) => {
    if (!editingQuantity) {
      setSelectedRowIndex(index)
      setEditingQuantity(true)
      const item = items[index]
      setQuantityInput(item.quantity.toString())
    }
  }

  useEffect(() => {
    if (!showProductModal && !editingQuantity) {
      barcodeInputRef.current?.focus()
    }
  }, [showProductModal, editingQuantity])

  useEffect(() => {
    if (showProductModal) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [showProductModal])

  const total = getTotal()

  return (
    <div className={styles.page}>
      <Header title="Punto de Venta" />

      <div className={styles.container}>
        {/* Header Minimalista */}
        <div className={styles.salesHeader}>
          <div className={styles.headerContent}>
           
            <div className={styles.totalSection}>
              <span className={styles.totalLabel}>TOTAL</span>
              <span className={styles.totalAmount}>{formatCurrency(total)}</span>
            </div>

            <div className={styles.currencySection}>
              <button
                className={`${styles.currencyBtn} ${currency === "GS" ? styles.currencyBtnActive : ""}`}
                onClick={() => setCurrency("GS")}
              >
                <span className={styles.currencySymbol}>₲</span>
                <div className={styles.currencyInfo}>
                  <span className={styles.currencyName}>Guaraní</span>
                  <span className={styles.currencyValue}>{formatCurrency(getTotalInCurrency("GS") * 1)}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Barcode Input */}
        <div className={styles.barcodeSection}>
          <form onSubmit={handleBarcodeSubmit} className={styles.barcodeForm}>
            <div className={styles.barcodeWrapper}>
              <Barcode size={20} className={styles.barcodeIcon} />
              <input
                ref={barcodeInputRef}
                placeholder="Escanear código de barras..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className={styles.barcodeInput}
                disabled={editingQuantity}
              />
            </div>
          </form>
          <div className={styles.shortcuts}>
            <span className={styles.shortcut}><kbd>F2</kbd> Buscar</span>
            <span className={styles.shortcut}><kbd>Ctrl+E</kbd> Eliminar</span>
            <span className={styles.shortcut}><kbd>F12</kbd> Cobrar</span>
            <span className={styles.shortcut}><kbd>↑↓</kbd> Navegar</span>
          </div>
        </div>

        {/* Tabla de Productos */}
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th className={styles.tableHeader} style={{ width: "50px" }}>#</th>
                <th className={styles.tableHeader} style={{ width: "130px" }}>Código</th>
                <th className={styles.tableHeader}>Descripción</th>
                <th className={styles.tableHeader} style={{ width: "120px" }}>Cantidad</th>
                <th className={styles.tableHeader} style={{ width: "130px" }}>Precio</th>
                <th className={styles.tableHeader} style={{ width: "150px" }}>SubTotal</th>
              </tr>
            </thead>
            <tbody className={styles.tableBody}>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyRow}>
                    <div className={styles.emptyState}>
                      <ShoppingCart size={48} className={styles.emptyIcon} />
                      <p>No hay productos en la venta</p>
                      <p className={styles.emptyHint}>
                        Escanea código de barras o presiona <kbd>F2</kbd> para buscar
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr 
                    key={item.product.id} 
                    className={`${styles.tableRow} ${selectedRowIndex === index ? styles.tableRowSelected : ""}`}
                    onClick={() => setSelectedRowIndex(index)}
                  >
                    <td className={styles.tableCell}>{index + 1}</td>
                    <td className={styles.tableCell}>
                      <span className={styles.codeText}>{item.product.barcode || item.product.id}</span>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.productInfo}>
                        <span className={styles.productName}>{item.product.name}</span>
                      </div>
                    </td>
                    <td className={styles.tableCell}>
                      {editingQuantity && selectedRowIndex === index ? (
                        <input
                          ref={quantityInputRef}
                          type="number"
                          value={quantityInput}
                          onChange={(e) => setQuantityInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              handleQuantitySubmit()
                            }
                            if (e.key === "Escape") {
                              setEditingQuantity(false)
                              setQuantityInput("")
                              barcodeInputRef.current?.focus()
                            }
                          }}
                          className={styles.quantityInputEditing}
                          min="1"
                        />
                      ) : (
                        <div 
                          className={styles.quantityDisplay}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQuantityClick(index)
                          }}
                        >
                          <span className={styles.quantityValue}>{item.quantity}</span>
                        </div>
                      )}
                    </td>
                    <td className={styles.tableCell}>
                      <span className={styles.priceText}>{formatCurrency(item.product.salePrice)}</span>
                    </td>
                    <td className={styles.tableCell}>
                      <strong className={styles.subtotalText}>
                        {formatCurrency(item.product.salePrice * item.quantity)}
                      </strong>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Product Search Modal */}
      {showProductModal && (
        <div className={styles.modalOverlay} onClick={() => setShowProductModal(false)}>
          <div className={styles.productModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Buscar Producto</h2>
              <button className={styles.closeBtn} onClick={() => setShowProductModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalSearch}>
              <Search size={20} className={styles.searchIcon} />
              <input
                ref={searchInputRef}
                placeholder="Buscar por nombre o código..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setSelectedProductIndex(0)
                }}
                onKeyDown={handleProductModalKeyDown}
                className={styles.modalSearchInput}
              />
            </div>

            <div className={styles.productList}>
              {filteredProducts.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => handleAddProduct(product)}
                  className={`${styles.productRow} ${selectedProductIndex === index ? styles.productRowSelected : ""}`}
                  onMouseEnter={() => setSelectedProductIndex(index)}
                >
                  <div className={styles.productRowCode}>{product.barcode || product.id}</div>
                  <div className={styles.productRowName}>{product.name}</div>
                  <div className={styles.productRowStock}>Stock: {product.stock}</div>
                  <div className={styles.productRowPrice}>{formatCurrency(product.salePrice)}</div>
                </button>
              ))}
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.modalHints}>
                <kbd>↑↓</kbd> Navegar
                <kbd>Enter</kbd> Seleccionar
                <kbd>Esc</kbd> Cerrar
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.confirmIcon}>
              <AlertCircle size={40} />
            </div>
            <h2 className={styles.confirmTitle}>¿Finalizar venta?</h2>
            <p className={styles.confirmDescription}>
              Total: <strong>{formatCurrency(total)}</strong>
            </p>
            <div className={styles.confirmButtons}>
              <button
                ref={confirmCancelRef}
                className={`${styles.confirmCancel} ${confirmModalSelectedButton === "cancel" ? styles.buttonFocused : ""}`}
                onClick={() => {
                  setShowConfirmModal(false)
                  barcodeInputRef.current?.focus()
                }}
              >
                Cancelar
              </button>
              <button
                ref={confirmAcceptRef}
                className={`${styles.confirmAccept} ${confirmModalSelectedButton === "accept" ? styles.buttonFocused : ""}`}
                onClick={handleCompleteSale}
              >
                Aceptar
              </button>
            </div>
            <div className={styles.confirmHint}>
              <kbd>←→</kbd> Navegar <kbd>Enter</kbd> Confirmar <kbd>Esc</kbd> Cancelar
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.paymentModal}>
            {saleComplete ? (
              <div className={styles.successState}>
                <div className={styles.successIcon}>
                  <Check size={32} />
                </div>
                <h2 className={styles.successTitle}>Venta completada</h2>
              </div>
            ) : (
              <>
                <div className={styles.paymentHeader}>
                  <h2 className={styles.paymentTitle}>Finalizar venta</h2>
                  <p className={styles.paymentTotal}>Total a cobrar: <strong>{formatCurrency(total)}</strong></p>
                </div>

                <div className={styles.paymentContent}>
                  <p className={styles.paymentLabel}>Método de pago</p>
                  <div className={styles.paymentOptions}>
                    <button
                      className={`${styles.paymentOption} ${paymentMethod === "cash" ? styles.paymentOptionActive : ""}`}
                      onClick={() => setPaymentMethod("cash")}
                    >
                      <Banknote size={28} />
                      <span>Efectivo</span>
                    </button>
                    <button
                      className={`${styles.paymentOption} ${paymentMethod === "card" ? styles.paymentOptionActive : ""}`}
                      onClick={() => setPaymentMethod("card")}
                    >
                      <CreditCard size={28} />
                      <span>Tarjeta</span>
                    </button>
                    <button
                      className={`${styles.paymentOption} ${paymentMethod === "transfer" ? styles.paymentOptionActive : ""}`}
                      onClick={() => setPaymentMethod("transfer")}
                    >
                      <ArrowRightLeft size={28} />
                      <span>Transferencia</span>
                    </button>
                  </div>
                </div>

                <div className={styles.paymentFooter}>
                  <button 
                    ref={paymentCancelRef}
                    className={`${styles.paymentCancel} ${paymentModalSelectedButton === "cancel" ? styles.buttonFocused : ""}`}
                    onClick={() => {
                      setShowPaymentModal(false)
                      barcodeInputRef.current?.focus()
                    }}
                  >
                    Cancelar
                  </button>
                  <button 
                    ref={paymentConfirmRef}
                    className={`${styles.paymentConfirm} ${paymentModalSelectedButton === "confirm" ? styles.buttonFocused : ""}`}
                    onClick={handleFinalizeSale}
                  >
                    Confirmar venta
                  </button>
                </div>

                <div className={styles.paymentHint}>
                  <kbd>←→</kbd> Cambiar método <kbd>↑↓</kbd> Cambiar botón <kbd>Enter</kbd> Confirmar <kbd>Esc</kbd> Cancelar
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}