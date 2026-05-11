import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

type ShortcutMap = Record<string, string>

const DEFAULT_SHORTCUTS: ShortcutMap = {
  "ctrl+d": "/dashboard",
  "ctrl+v": "/dashboard/sales/pos",
  "ctrl+h": "/dashboard/sales/history",
  "ctrl+i": "/dashboard/products",
  "ctrl+b": "/dashboard/purchases/new",
  "ctrl+j": "/dashboard/purchases/history",
  "ctrl+c": "/dashboard/clients",
  "ctrl+p": "/dashboard/suppliers",
  "ctrl+k": "/dashboard/cash",
  "ctrl+r": "/dashboard/reports",
}

export function useKeyboardNav(shortcuts: ShortcutMap = DEFAULT_SHORTCUTS) {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)

  const toggleHelp = useCallback(() => setShowHelp(prev => !prev), [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      if (["input", "textarea", "select"].includes(tag)) return
      if ((e.target as HTMLElement).isContentEditable) return

      // Ctrl+? or Ctrl+/ 
      if (e.ctrlKey && (e.key === "?" || e.key === "/")) {
        e.preventDefault()
        setShowHelp(prev => !prev)
        return
      }

      // Escape closes the modal
      if (e.key === "Escape" && showHelp) {
        setShowHelp(false)
        return
      }

      const combo = [
        e.ctrlKey && "ctrl",
        e.altKey && "alt",
        e.shiftKey && "shift",
        e.key.toLowerCase(),
      ]
        .filter(Boolean)
        .join("+")

      const href = shortcuts[combo]
      if (href) {
        e.preventDefault()
        router.push(href)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [router, shortcuts, showHelp])

  return { showHelp, setShowHelp, toggleHelp }
}
