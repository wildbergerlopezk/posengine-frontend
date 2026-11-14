"use client"

import { useRef } from "react"
import { Package, RotateCcw } from "lucide-react"
import styles from "./DetailModalTabs.module.css"

export type DetailModalTab = "summary" | "returns"

interface Props {
  id: string
  value: DetailModalTab
  onChange: (tab: DetailModalTab) => void
  disabled?: boolean
}

export function DetailModalTabs({ id, value, onChange, disabled = false }: Props) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const tabs: Array<{ value: DetailModalTab; label: string; icon: typeof Package }> = [
    { value: "summary", label: "Resumen", icon: Package },
    { value: "returns", label: "Devoluciones", icon: RotateCcw },
  ]

  const selectTab = (index: number) => {
    const tab = tabs[index]
    onChange(tab.value)
    tabRefs.current[index]?.focus()
  }

  return (
    <div className={styles.tabs} role="tablist" aria-label="Secciones del detalle">
      {tabs.map(({ value: tab, label, icon: Icon }, index) => (
        <button
          key={tab}
          ref={(element) => { tabRefs.current[index] = element }}
          id={`${id}-${tab}-tab`}
          type="button"
          role="tab"
          aria-selected={value === tab}
          aria-controls={`${id}-${tab}-panel`}
          tabIndex={value === tab ? 0 : -1}
          disabled={disabled}
          className={`${styles.tab} ${value === tab ? styles.active : ""}`}
          onClick={() => onChange(tab)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault()
              selectTab((index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length)
            } else if (event.key === "Home") {
              event.preventDefault()
              selectTab(0)
            } else if (event.key === "End") {
              event.preventDefault()
              selectTab(tabs.length - 1)
            }
          }}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
