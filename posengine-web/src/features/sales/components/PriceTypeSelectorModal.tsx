"use client"

import React, { useState, useEffect } from "react"
import { Users, User } from "lucide-react"
import styles from "./PriceTypeSelectorModal.module.css"
import { formatCurrency } from "@/src/shared/hooks/useFormatCurrency"

interface Product {
    id: string
    name: string
    cost?: number
    price: number
    wholesalePrice: number
}

interface PriceTypeSelectorModalProps {
    product: Product
    onSelect: (type: "PUBLIC" | "WHOLESALE", price: number) => void
    onClose: () => void
}

export function PriceTypeSelectorModal({ product, onSelect, onClose }: PriceTypeSelectorModalProps) {
    const [selectedIndex, setSelectedIndex] = useState(0) // 0: Public, 1: Wholesale

    const cost = product.cost ?? 0
    const publicPrice = product.price
    const wholesalePrice = product.wholesalePrice || product.price
    
    const publicMargin = cost > 0 ? ((publicPrice / cost) - 1) * 100 : 0
    const wholesaleMargin = cost > 0 ? ((wholesalePrice / cost) - 1) * 100 : 0

    const options = [
        { 
            type: "PUBLIC" as const, 
            label: "Precio Público", 
            price: publicPrice, 
            margin: publicMargin,
            icon: <User size={20} />
        },
        { 
            type: "WHOLESALE" as const, 
            label: "Precio Mayorista", 
            price: wholesalePrice, 
            margin: wholesaleMargin,
            icon: <Users size={20} />
        }
    ]

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault()
                setSelectedIndex(prev => (prev === 0 ? 1 : 0))
            }
            if (e.key === "Enter") {
                e.preventDefault()
                const opt = options[selectedIndex]
                onSelect(opt.type, opt.price)
            }
            if (e.key === "Escape") {
                onClose()
            }
        }

        // Pequeño retraso para no capturar el mismo Enter que abrió el modal
        const t = setTimeout(() => {
            window.addEventListener("keydown", handler)
        }, 100)

        return () => {
            clearTimeout(t)
            window.removeEventListener("keydown", handler)
        }
    }, [selectedIndex, onSelect, onClose, options])

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Seleccionar tipo de precio</h2>
                    <p className={styles.subtitle}>{product.name}</p>
                </div>

                <div className={styles.costInfo}>
                    <span className={styles.costLabel}>Costo base:</span>
                    <span className={styles.costValue}>{formatCurrency(cost)}</span>
                </div>

                <div className={styles.options}>
                    {options.map((opt, idx) => (
                        <button
                            key={opt.type}
                            type="button"
                            className={`${styles.optionBtn} ${selectedIndex === idx ? styles.optionBtnActive : ""}`}
                            onClick={() => onSelect(opt.type, opt.price)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                        >
                            <div className={styles.optionIcon}>{opt.icon}</div>
                            <div className={styles.optionInfo}>
                                <span className={styles.optionLabel}>{opt.label}</span>
                                <div className={styles.optionDetails}>
                                    <span className={styles.optionMargin}>{opt.margin.toFixed(1)}% ganancia</span>
                                </div>
                            </div>
                            <div className={styles.optionPrice}>
                                {formatCurrency(opt.price)}
                            </div>
                        </button>
                    ))}
                </div>

                <div className={styles.footer}>
                    <span><kbd>↑↓</kbd> Navegar</span>
                    <span><kbd>Enter</kbd> Confirmar</span>
                    <span><kbd>Esc</kbd> Cancelar</span>
                </div>
            </div>
        </div>
    )
}
