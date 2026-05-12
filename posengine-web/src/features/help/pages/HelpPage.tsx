"use client"

import React from "react"
import { Header } from "@/src/shared/components/Header"
import { 
  Book, Package, ShoppingCart, Wallet, 
  Users, Truck, Keyboard, Printer, 
  ChevronRight, Search, HelpCircle, FileText
} from "lucide-react"
import styles from "./HelpPage.module.css"

interface HelpSectionProps {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}

const HelpSection = ({ icon: Icon, title, children }: HelpSectionProps) => (
  <section className={styles.section}>
    <div className={styles.sectionHeader}>
      <div className={styles.sectionIcon}>
        <Icon size={24} />
      </div>
      <h2 className={styles.sectionTitle}>{title}</h2>
    </div>
    <div className={styles.sectionContent}>
      {children}
    </div>
  </section>
)

export function HelpPage() {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className={styles.page}>
      <Header title="Ayuda y Manual de Usuario" />
      
      <div className={styles.container}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <h3 className={styles.sidebarTitle}>Contenido</h3>
            <nav className={styles.nav}>
              <a href="#introduccion" className={styles.navLink}><ChevronRight size={14} /> Introducción</a>
              <a href="#productos" className={styles.navLink}><ChevronRight size={14} /> Gestión de Productos</a>
              <a href="#compras" className={styles.navLink}><ChevronRight size={14} /> Compras y Stock</a>
              <a href="#ventas" className={styles.navLink}><ChevronRight size={14} /> Punto de Venta</a>
              <a href="#caja" className={styles.navLink}><ChevronRight size={14} /> Sesiones de Caja</a>
              <a href="#atajos" className={styles.navLink}><ChevronRight size={14} /> Atajos de Teclado</a>
            </nav>
            <button onClick={handlePrint} className={styles.printButton}>
              <Printer size={16} /> Exportar Manual (PDF)
            </button>
          </div>
        </aside>

        <main className={styles.content}>
          <div id="introduccion" className={styles.introCard}>
            <HelpCircle size={40} className={styles.introIcon} />
            <h1>Bienvenido al Manual de PosEngine</h1>
            <p>
              Esta guía te ayudará a dominar todas las herramientas del sistema. 
              PosEngine está diseñado para ser rápido, eficiente y fácil de usar, 
              especialmente optimizado para el uso con teclado.
            </p>
          </div>

          <HelpSection icon={Package} title="Gestión de Productos">
            <div id="productos">
              <p>El módulo de productos es el corazón de tu inventario.</p>
              <ul>
                <li><strong>Registro:</strong> Puedes agregar productos con código de barras, nombre, costo y precio de venta.</li>
                <li><strong>Stock:</strong> El sistema controla automáticamente el stock disponible.</li>
                <li><strong>Categorías:</strong> Organiza tus productos por categorías y subcategorías para una mejor búsqueda.</li>
                <li><strong>Búsqueda:</strong> Utiliza el buscador principal para filtrar por nombre o código rápidamente.</li>
              </ul>
            </div>
          </HelpSection>

          <HelpSection icon={ShoppingCart} title="Compras y Recepción de Stock">
            <div id="compras">
              <p>Registra las compras a tus proveedores para aumentar tu stock y actualizar costos.</p>
              <ul>
                <li><strong>Nueva Compra:</strong> Selecciona el proveedor e ingresa el número de factura.</li>
                <li><strong>Carga Rápida:</strong> Usa <kbd>F2</kbd> para buscar productos o escanea el código de barras.</li>
                <li><strong>Ajuste de Precios:</strong> Al cargar un ítem, se abrirá un modal para que ajustes el costo y el nuevo precio de venta inmediatamente.</li>
                <li><strong>Actualización Automática:</strong> Al finalizar la compra, el sistema actualiza el stock y los precios en tu catálogo.</li>
              </ul>
            </div>
          </HelpSection>

          <HelpSection icon={Printer} title="Ventas y Facturación">
            <div id="ventas">
              <p>El Punto de Venta (POS) está optimizado para la velocidad.</p>
              <ul>
                <li><strong>Búsqueda:</strong> Escanea productos para agregarlos al carrito al instante.</li>
                <li><strong>Pagos:</strong> Soporta pagos en efectivo y crédito.</li>
                <li><strong>Impresión:</strong> Una vez confirmada la venta, se genera el comprobante listo para imprimir.</li>
              </ul>
            </div>
          </HelpSection>

          <HelpSection icon={Wallet} title="Control de Caja">
            <div id="caja">
              <p>Asegura el control del efectivo en tu negocio.</p>
              <ul>
                <li><strong>Apertura:</strong> Debes abrir caja con un monto inicial antes de realizar ventas o compras al contado.</li>
                <li><strong>Movimientos:</strong> El sistema registra cada entrada y salida de efectivo automáticamente.</li>
                <li><strong>Cierre:</strong> Al finalizar el día, realiza el cierre para verificar que el efectivo físico coincida con el sistema.</li>
                <li><strong>Historial:</strong> Consulta sesiones anteriores para auditorías.</li>
              </ul>
            </div>
          </HelpSection>

          <HelpSection icon={Keyboard} title="Atajos de Teclado (Power User)">
            <div id="atajos">
              <p>Domina el sistema sin tocar el mouse:</p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Acción</th>
                    <th>Atajo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Ver Atajos</td><td><kbd>Ctrl</kbd> + <kbd>/</kbd></td></tr>
                  <tr><td>Agregar Producto (Compras/Ventas)</td><td><kbd>F2</kbd></td></tr>
                  <tr><td>Finalizar Operación</td><td><kbd>F12</kbd></td></tr>
                  <tr><td>Generar Nro. Factura (Compras)</td><td><kbd>Alt</kbd> + <kbd>Q</kbd></td></tr>
                  <tr><td>Ver Historial Precios (en búsqueda)</td><td><kbd>F8</kbd></td></tr>
                </tbody>
              </table>
            </div>
          </HelpSection>
        </main>
      </div>
    </div>
  )
}
