"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react"
import styles from "./ImageDropPasteArea.module.css"

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

interface ImageDropPasteAreaProps {
  children: ReactNode
  className?: string
  disabled?: boolean
  onImage: (file: File) => void
  onValidationError?: (message: string | null) => void
}

export function ImageDropPasteArea({ children, className, disabled = false, onImage, onValidationError }: ImageDropPasteAreaProps) {
  const areaRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const acceptImage = useCallback((file: File) => {
    if (disabled) return
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      const message = "El archivo debe ser JPG, PNG o WebP."
      setValidationError(message)
      onValidationError?.(message)
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      const message = "La imagen no puede superar los 5 MB."
      setValidationError(message)
      onValidationError?.(message)
      return
    }

    setValidationError(null)
    onValidationError?.(null)
    onImage(file)
  }, [disabled, onImage, onValidationError])

  useEffect(() => {
    if (disabled) return

    const handlePaste = (event: ClipboardEvent) => {
      const area = areaRef.current
      const activeElementIsInside = Boolean(area?.contains(document.activeElement))
      const pointerIsInside = Boolean(area?.matches(":hover"))
      if (!activeElementIsInside && !pointerIsInside) return

      const imageItem = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      const file = imageItem?.getAsFile()
      if (!file) return

      event.preventDefault()
      acceptImage(file)
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [acceptImage, disabled])

  const handleFileChange = (event: ChangeEvent<HTMLDivElement>) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return

    const file = input.files?.[0]
    input.value = ""
    if (file) acceptImage(file)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !Array.from(event.dataTransfer.types).includes("Files")) return
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    setIsDragging(false)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return
    event.preventDefault()
    setIsDragging(false)
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"))
    if (file) acceptImage(file)
  }

  return (
    <div
      ref={areaRef}
      className={`${styles.area} ${className ?? ""} ${isDragging ? styles.dragging : ""}`}
      onChange={handleFileChange}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-busy={disabled}
    >
      {children}
      {isDragging && <div className={styles.dropHint}>Soltá la imagen para subirla</div>}
      {validationError && !onValidationError && <p className={styles.error} role="alert">{validationError}</p>}
    </div>
  )
}
