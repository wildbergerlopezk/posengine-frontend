"use client"

import React from "react"
import { 
  X, Keyboard, LayoutDashboard, Package, Users, Truck, 
  Wallet, PlusCircle, History 
} from "lucide-react"
import styles from "./KeyboardShortcutsModal.module.css"

interface ShortcutProps {
  icon: React.ElementType
  label: string
  keys: string[]
}

const ShortcutItem = ({ icon: Icon, label, keys }: ShortcutProps) => (
  <div className={styles.shortcutItem}>
    <div className={styles.shortcutInfo}>
      <div className={styles.shortcutIcon}>
        <Icon size={18} />
      </div>
      <span className={styles.shortcutLabel}>{label}</span>
    </div>
    <div className={styles.keys}>
      {keys.map((key, index) => (
        <React.Fragment key={key}>
          <kbd className={styles.key}>{key}</kbd>
          {index < keys.length - 1 && <span className={styles.plus}>+</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
)

interface KeyboardShortcutsModalProps {
  onClose: () => void
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  // Prevent closing when clicking inside the modal
  const handleModalClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={handleModalClick}>
        <header className={styles.header}>
          <div className={styles.title}>
            <Keyboard size={24} />
            <span>Atajos de teclado</span>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className={styles.content}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Navegación General</h3>
            <div className={styles.shortcutList}>
              <ShortcutItem icon={LayoutDashboard} label="Dashboard" keys={["Ctrl", "D"]} />
              <ShortcutItem icon={Package} label="Productos" keys={["Ctrl", "I"]} />
              <ShortcutItem icon={Users} label="Clientes" keys={["Ctrl", "C"]} />
              <ShortcutItem icon={Truck} label="Proveedores" keys={["Ctrl", "P"]} />
              <ShortcutItem icon={Wallet} label="Caja" keys={["Ctrl", "K"]} />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Ventas</h3>
            <div className={styles.shortcutList}>
              <ShortcutItem icon={PlusCircle} label="Nueva venta" keys={["Ctrl", "V"]} />
              <ShortcutItem icon={History} label="Historial de ventas" keys={["Ctrl", "H"]} />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Compras</h3>
            <div className={styles.shortcutList}>
              <ShortcutItem icon={PlusCircle} label="Registrar compra" keys={["Ctrl", "B"]} />
              <ShortcutItem icon={History} label="Historial de compras" keys={["Ctrl", "J"]} />
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <kbd className={styles.key}>Ctrl</kbd>
          <span className={styles.plus}>+</span>
          <kbd className={styles.key}>/</kbd>
          <span>para abrir y cerrar este panel</span>
        </footer>
      </div>
    </div>
  )
}
