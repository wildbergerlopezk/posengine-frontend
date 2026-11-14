import type { LabelCopy, LabelFormat } from "../types/label.types"
import { Code128Barcode } from "./Code128Barcode"
import styles from "../labels.module.css"
import { Package } from "lucide-react"
import { useState } from "react"

interface ProductLabelProps {
  product: LabelCopy
  format: LabelFormat
}

export function ProductLabel({ product, format }: ProductLabelProps) {
  const productIdentifier = product.sku || product.barcode || "Sin identificador"
  const barcode = (
    <Code128Barcode
      value={product.barcode || undefined}
      showValue={Boolean(product.barcode && product.sku && product.barcode !== product.sku)}
      availableWidthMm={format.barcodeAvailableWidthMm}
    />
  )

  return (
    <article className={`${styles.label} ${format.id === "large" ? styles.largeLabel : styles.smallLabel}`}>
      <div className={styles.labelMain}>
        <h3 className={styles.labelName}>{product.name}</h3>
        {format.id === "small" ? (
          <>
            <div className={`${styles.labelBottomline} ${styles.smallLabelDetails}`}>
              <span className={styles.labelSku} title={productIdentifier}>{productIdentifier}</span>
              <strong className={styles.labelPrice}>{formatCurrency(product.price)}</strong>
            </div>
            {barcode}
          </>
        ) : (
          <>
            <span className={styles.labelSku}>{productIdentifier}</span>
            {barcode}
            <div className={styles.labelBottomline}>
              <strong className={styles.labelPrice}>{formatCurrency(product.price)}</strong>
            </div>
          </>
        )}
      </div>
      {format.id === "large" && <ProductImage name={product.name} src={product.imageUrl} />}
    </article>
  )
}

function ProductImage({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={styles.labelImagePlaceholder} role="img" aria-label={`Imagen no disponible: ${name}`}>
        <Package size={22} strokeWidth={1.5} aria-hidden="true" />
      </div>
    )
  }

  return <img className={styles.labelImage} src={src} alt={name} onError={() => setFailed(true)} />
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency: "PYG",
    maximumFractionDigits: 0,
  }).format(amount)
}
