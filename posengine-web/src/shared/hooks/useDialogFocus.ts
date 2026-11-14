import { useEffect, type RefObject } from "react"

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  active = true,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return

    const dialog = dialogRef.current
    if (!dialog) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const getFocusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true")

    const focusableElements = getFocusableElements()
    ;(initialFocusRef?.current ?? focusableElements[0] ?? dialog).focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return

      const elements = getFocusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const focusedElement = document.activeElement

      if (focusedElement === dialog) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
        return
      }

      if (event.shiftKey && (focusedElement === first || !dialog.contains(focusedElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (focusedElement === last || !dialog.contains(focusedElement))) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [active, dialogRef, initialFocusRef])
}
