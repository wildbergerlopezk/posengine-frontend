"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { assessCode128, renderCode128 } from "../utils/code128"
import styles from "../labels.module.css"

interface Code128BarcodeProps {
  value?: string
  showValue?: boolean
  availableWidthMm: number
}

export function Code128Barcode({ value, showValue = false, availableWidthMm }: Code128BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [renderFailed, setRenderFailed] = useState(false)
  const assessment = useMemo(
    () => assessCode128(value, availableWidthMm),
    [value, availableWidthMm],
  )

  useEffect(() => {
    setRenderFailed(false)
    const svg = svgRef.current
    if (!svg || !value || assessment.status !== "ready") return

    try {
      renderCode128(svg, value)
      svg.dataset.code128Rendered = "true"
    } catch {
      svg.replaceChildren()
      delete svg.dataset.code128Rendered
      setRenderFailed(true)
    }

    return () => {
      svg.replaceChildren()
      delete svg.dataset.code128Rendered
    }
  }, [assessment.status, value])

  return (
    <div
      className={styles.labelBarcode}
      data-code128-status={renderFailed ? "render-failed" : assessment.status}
    >
      {assessment.status === "ready" && !renderFailed && (
        <svg
          ref={svgRef}
          className={styles.barcodeSvg}
          role="img"
          aria-label={`Código de barras Code 128 ${value}`}
          style={{ width: `${assessment.widthMm}mm`, height: `${assessment.heightMm}mm` }}
        />
      )}
      {value && showValue && <span className={styles.barcodeValue}>{value}</span>}
    </div>
  )
}
