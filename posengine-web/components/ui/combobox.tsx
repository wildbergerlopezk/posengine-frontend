"use client"

import React from "react"
import {
  createContext, useContext, useRef, useState,
  useEffect, useCallback, useId,
} from "react"
import { SelectButton } from "@/components/ui/select-button"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComboboxItem {
  label: string
  value: string
}

interface ComboboxContextValue {
  items: ComboboxItem[]
  filtered: ComboboxItem[]
  selected: ComboboxItem | null
  open: boolean
  search: string
  activeIndex: number
  setOpen: (v: boolean) => void
  setSearch: (v: string) => void
  setActiveIndex: (v: number) => void
  selectItem: (item: ComboboxItem) => void
  triggerId: string
  popupId: string
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

const ComboboxContext = createContext<ComboboxContextValue | null>(null)

function useCombobox() {
  const ctx = useContext(ComboboxContext)
  if (!ctx) throw new Error("Combobox components must be used inside <Combobox>")
  return ctx
}

// ─── Root ─────────────────────────────────────────────────────────────────────

interface ComboboxProps {
  items: ComboboxItem[]
  value?: ComboboxItem | null
  onValueChange?: (item: ComboboxItem | null) => void
  children: React.ReactNode
}

export function Combobox({ items, value, onValueChange, children }: ComboboxProps) {
  const [open, setOpenRaw] = useState(false)
  const [search, setSearchRaw] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [internalSelected, setInternalSelected] = useState<ComboboxItem | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()
  const triggerId = `combobox-trigger-${id}`
  const popupId = `combobox-popup-${id}`

  const selected = value !== undefined ? value : internalSelected

  const filtered = search.trim()
    ? items.filter(i => i.label.toLowerCase().includes(search.trim().toLowerCase()))
    : items

  const setOpen = useCallback((v: boolean) => {
    setOpenRaw(v)
    if (!v) { setSearchRaw(""); setActiveIndex(0) }
  }, [])

  const setSearch = useCallback((v: string) => {
    setSearchRaw(v)
    setActiveIndex(0)
  }, [])

  const selectItem = useCallback((item: ComboboxItem) => {
    if (value === undefined) setInternalSelected(item)
    onValueChange?.(item)
    setOpen(false)
    triggerRef.current?.focus()
  }, [value, onValueChange, setOpen])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById(popupId)
      const trigger = triggerRef.current
      if (popup && !popup.contains(e.target as Node) && !trigger?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, popupId, setOpen])

  return (
    <ComboboxContext.Provider value={{
      items, filtered, selected, open, search, activeIndex,
      setOpen, setSearch, setActiveIndex, selectItem,
      triggerId, popupId, triggerRef,
    }}>
      <div style={{ position: "relative", width: "100%" }}>
        {children}
      </div>
    </ComboboxContext.Provider>
  )
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

interface ComboboxTriggerProps {
  children: React.ReactNode
  className?: string
}

export function ComboboxTrigger({ children, className }: ComboboxTriggerProps) {
  const { open, setOpen, triggerId, popupId, triggerRef } = useCombobox()

  return (
    <SelectButton
      id={triggerId}
      className={className}
      style={{
        height: "2.5rem",
        width: "100%",
        border: "1px solid var(--color-border)",
        borderRadius: "0.375rem",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
        padding: "0 0.75rem",
        fontSize: "0.875rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",  // ← esto
        textAlign: "left",                 // ← y esto
      }}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={popupId}
      ref={triggerRef}
      onClick={() => setOpen(!open)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault()
          setOpen(true)
        }
        if (e.key === "Escape") setOpen(false)
      }}
    >
      {children}
    </SelectButton>
  )
}

// ─── Value ────────────────────────────────────────────────────────────────────

export function ComboboxValue({ placeholder }: { placeholder?: string }) {
  const { selected } = useCombobox()
  return (
    <span style={{ color: selected ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}>
      {selected ? selected.label : (placeholder ?? "Seleccionar…")}
    </span>
  )
}

// ─── Popup ────────────────────────────────────────────────────────────────────

interface ComboboxPopupProps {
  children: React.ReactNode
  "aria-label"?: string
}

export function ComboboxPopup({ children, "aria-label": ariaLabel }: ComboboxPopupProps) {
  const { open, popupId } = useCombobox()
  if (!open) return null

  return (
    <div
      id={popupId}
      role="listbox"
      aria-label={ariaLabel}
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        right: 0,
        zIndex: 50,
        background: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.75rem",
        boxShadow: "0 10px 30px -5px rgba(0,0,0,0.2)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxHeight: "22rem",
        animation: "comboboxFadeIn 0.12s ease",
      }}
    >
      <style>{`
        @keyframes comboboxFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {children}
    </div>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface ComboboxInputProps {
  placeholder?: string
  showTrigger?: boolean
  startAddon?: React.ReactNode
  className?: string
}

export function ComboboxInput({ placeholder, startAddon, className = "" }: ComboboxInputProps) {
  const { search, setSearch, filtered, activeIndex, setActiveIndex, selectItem } = useCombobox()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  return (
    <div style={{ position: "relative" }}>
      {startAddon && (
        <span style={{
          position: "absolute", left: "0.75rem", top: "50%",
          transform: "translateY(-50%)",
          color: "var(--color-muted-foreground)",
          display: "flex", alignItems: "center",
          pointerEvents: "none",
        }}>
          {React.isValidElement(startAddon)
            ? React.cloneElement(startAddon as React.ReactElement<{ size?: number }>, { size: 15 })
            : startAddon}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        className={className}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: "2.25rem",
          padding: startAddon ? "0 0.75rem 0 2.25rem" : "0 0.75rem",
          border: "1px solid var(--color-border)",
          borderRadius: "0.375rem",
          background: "var(--color-background)",
          color: "var(--color-foreground)",
          fontSize: "0.875rem",
          boxSizing: "border-box",
          outline: "none",
        }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiveIndex(Math.min(filtered.length - 1, activeIndex + 1))
          }
          if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiveIndex(Math.max(0, activeIndex - 1))
          }
          if (e.key === "Enter") {
            e.preventDefault()
            const item = filtered[activeIndex]
            if (item) selectItem(item)
          }
          if (e.key === "Escape") {
            e.stopPropagation()
          }
        }}
      />
    </div>
  )
}

// ─── Empty ────────────────────────────────────────────────────────────────────

export function ComboboxEmpty({ children }: { children: React.ReactNode }) {
  const { filtered } = useCombobox()
  if (filtered.length > 0) return null
  return (
    <div style={{
      padding: "2rem 1rem",
      textAlign: "center",
      color: "var(--color-muted-foreground)",
      fontSize: "0.875rem",
    }}>
      {children}
    </div>
  )
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function ComboboxList({
  children,
}: {
  children: (item: ComboboxItem) => React.ReactNode
}) {
  const { filtered } = useCombobox()

  return (
    <div
      role="listbox"
      style={{ overflowY: "auto", flex: 1 }}
    >
      {filtered.map((item) => (
        <React.Fragment key={item.value}>
          {children(item)}
        </React.Fragment>
      ))}
    </div>
  )
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface ComboboxItemProps {
  value: ComboboxItem
  children: React.ReactNode
  onSelect?: () => void
}

export function ComboboxItem({ value, children, onSelect }: ComboboxItemProps) {
  const { selectItem, selected, activeIndex, filtered, setActiveIndex } = useCombobox()
  const isSelected = selected?.value === value.value
  const idx = filtered.findIndex(i => i.value === value.value)
  const isActive = activeIndex === idx
  const itemRef = useRef<HTMLButtonElement>(null)

  // Scroll automático al item activo
  useEffect(() => {
    if (isActive) {
      itemRef.current?.scrollIntoView({ block: "nearest" })
    }
  }, [isActive])

  return (
    <button
      ref={itemRef}
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        selectItem(value)
        onSelect?.()
      }}
      onMouseEnter={() => setActiveIndex(idx)}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        padding: "0.625rem 1rem",
        border: "none",
        borderBottom: "1px solid var(--color-border)",
        background: isActive
          ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
          : "transparent",
        borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
        color: "var(--color-foreground)",
        fontSize: "0.875rem",
        cursor: "pointer",
        textAlign: "left",
        fontWeight: isSelected ? 600 : 400,
        transition: "background 0.1s",
      }}
    >
      {children}
    </button>
  )
}