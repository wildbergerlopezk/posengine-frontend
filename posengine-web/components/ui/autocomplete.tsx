"use client"

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
} from "react"

interface AutocompleteContextValue {
  search: string
  setSearch: (s: string) => void
  open: boolean
  setOpen: (b: boolean) => void
  activeIndex: number
  setActiveIndex: (n: number) => void
  filtered: any[]
  selectItem: (item: any) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  popupId: string
}

const AutocompleteContext = createContext<AutocompleteContextValue | null>(null)

function useAutocomplete() {
  const ctx = useContext(AutocompleteContext)
  if (!ctx) throw new Error("Autocomplete components must be used inside <Autocomplete>")
  return ctx
}

interface AutocompleteProps {
  items: any[]
  value?: any
  onValueChange?: (value: any) => void
  filterFn?: (item: any, search: string) => boolean
  children: React.ReactNode
}

export function Autocomplete({
  items,
  value,
  onValueChange,
  filterFn,
  children,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const popupId = `autocomplete-popup-${id}`

  // Default filter: match label/name or value (case insensitive)
  const defaultFilter = (item: any, query: string) => {
    const q = query.toLowerCase().trim()
    if (!q) return true
    const label = item.label || item.name || ""
    const val = item.value || item.id || ""
    const doc = item.documentNumber || ""
    const tax = item.taxId || ""
    return (
      label.toLowerCase().includes(q) ||
      val.toLowerCase().includes(q) ||
      doc.toLowerCase().includes(q) ||
      tax.toLowerCase().includes(q)
    )
  }

  const activeFilter = filterFn || defaultFilter
  const filtered = items.filter(item => activeFilter(item, search))

  const selectItem = useCallback(
    (item: any) => {
      onValueChange?.(item)
      // Set search to display the selected label
      setSearch(item.label || item.name || "")
      setOpen(false)
    },
    [onValueChange]
  )

  // Reset activeIndex when filter changes
  useEffect(() => {
    setActiveIndex(0)
  }, [search])

  // Close popup on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const popup = document.getElementById(popupId)
      const input = inputRef.current
      if (
        popup &&
        !popup.contains(e.target as Node) &&
        !input?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, popupId])

  return (
    <AutocompleteContext.Provider
      value={{
        search,
        setSearch,
        open,
        setOpen,
        activeIndex,
        setActiveIndex,
        filtered,
        selectItem,
        inputRef,
        popupId,
      }}
    >
      <div style={{ position: "relative", width: "100%" }}>{children}</div>
    </AutocompleteContext.Provider>
  )
}

export function AutocompleteInput({
  placeholder,
  "aria-label": ariaLabel,
  autoFocus,
  id,
}: {
  placeholder?: string
  "aria-label"?: string
  autoFocus?: boolean
  id?: string
}) {
  const {
    search,
    setSearch,
    open,
    setOpen,
    activeIndex,
    setActiveIndex,
    filtered,
    selectItem,
    inputRef,
  } = useAutocomplete()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!open) {
        setOpen(true)
      } else {
        setActiveIndex(Math.min(activeIndex + 1, filtered.length - 1))
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (open) {
        setActiveIndex(Math.max(activeIndex - 1, 0))
      }
    } else if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault()
        e.stopPropagation()
        selectItem(filtered[activeIndex])
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }
  }

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [autoFocus, inputRef])

  return (
    <input
      id={id}
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={search}
      onChange={e => {
        setSearch(e.target.value)
        setOpen(true)
      }}
      onFocus={() => setOpen(true)}
      onKeyDown={handleKeyDown}
      style={{
        width: "100%",
        height: "2.5rem",
        borderRadius: "0.375rem",
        border: "1px solid var(--color-border)",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
        padding: "0 0.75rem",
        fontSize: "0.875rem",
        outline: "none",
      }}
    />
  )
}

export function AutocompletePopup({ children }: { children: React.ReactNode }) {
  const { open, popupId } = useAutocomplete()
  if (!open) return null

  return (
    <div
      id={popupId}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        zIndex: 50,
        marginTop: "0.25rem",
        maxHeight: "15rem",
        overflowY: "auto",
        borderRadius: "0.375rem",
        border: "1px solid var(--color-border)",
        background: "var(--color-card)",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        padding: "0.25rem",
      }}
    >
      {children}
    </div>
  )
}

export function AutocompleteList({
  children,
}: {
  children: (item: any) => React.ReactNode
}) {
  const { filtered } = useAutocomplete()
  return <div style={{ display: "flex", flexDirection: "column" }}>{filtered.map(children)}</div>
}

export function AutocompleteItem({
  value,
  children,
}: {
  value: any
  children: React.ReactNode
}) {
  const { activeIndex, filtered, selectItem, setActiveIndex } = useAutocomplete()
  const idx = filtered.indexOf(value)
  const isActive = idx === activeIndex

  return (
    <div
      onClick={() => selectItem(value)}
      onMouseEnter={() => setActiveIndex(idx)}
      style={{
        padding: "0.5rem 0.75rem",
        fontSize: "0.875rem",
        borderRadius: "0.25rem",
        cursor: "pointer",
        background: isActive ? "var(--color-accent)" : "transparent",
        color: isActive ? "var(--color-accent-foreground)" : "var(--color-foreground)",
      }}
    >
      {children}
    </div>
  )
}

export function AutocompleteEmpty({ children }: { children: React.ReactNode }) {
  const { filtered } = useAutocomplete()
  if (filtered.length > 0) return null

  return (
    <div
      style={{
        padding: "0.5rem 0.75rem",
        fontSize: "0.875rem",
        color: "var(--color-muted-foreground)",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  )
}
