"use client"

import { useEffect, useRef } from "react"
import styles from "./SixDigitPinInput.module.css"

interface SixDigitPinInputProps {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  autoFocus?: boolean
  focusFirstOnClear?: boolean
}

export function SixDigitPinInput({ label, value, onChange, disabled = false, autoFocus = false, focusFirstOnClear = false }: SixDigitPinInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const previousValue = useRef(value)
  const focusAfterEnable = useRef(false)

  useEffect(() => {
    if (autoFocus && !disabled) inputs.current[0]?.focus()
  }, [autoFocus, disabled])

  useEffect(() => {
    if (focusFirstOnClear && previousValue.current.some(Boolean) && !value.some(Boolean)) {
      focusAfterEnable.current = true
    }
    if (focusFirstOnClear && focusAfterEnable.current && !disabled) {
      inputs.current[0]?.focus()
      focusAfterEnable.current = false
    }
    previousValue.current = value
  }, [disabled, focusFirstOnClear, value])

  const updateFrom = (index: number, rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "")
    const next = Array.from({ length: 6 }, (_, slot) => value[slot] ?? "")

    if (digits.length > 1) {
      for (let offset = 0; offset < digits.length && index + offset < 6; offset += 1) {
        next[index + offset] = digits[offset]
      }
      onChange(next)
      inputs.current[Math.min(index + digits.length, 5)]?.focus()
      return
    }

    next[index] = digits.slice(-1)
    onChange(next)
    if (digits && index < 5) inputs.current[index + 1]?.focus()
  }

  const pasteFrom = (index: number, pasted: string) => {
    const digits = pasted.replace(/\D/g, "")
    if (!digits) return
    const next = Array.from({ length: 6 }, (_, slot) => value[slot] ?? "")
    for (let offset = 0; offset < digits.length && index + offset < 6; offset += 1) {
      next[index + offset] = digits[offset]
    }
    onChange(next)
    inputs.current[Math.min(index + digits.length, 5)]?.focus()
  }

  return (
    <div className={styles.group} role="group" aria-label={label}>
      {Array.from({ length: 6 }, (_, index) => (
        <input
          key={index}
          ref={(element) => { inputs.current[index] = element }}
          aria-label={`${label}, dígito ${index + 1}`}
          className={styles.digit}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={index === 0 ? 6 : 1}
          value={value[index] ?? ""}
          disabled={disabled}
          onChange={(event) => updateFrom(index, event.target.value)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text")
            if (pasted.replace(/\D/g, "").length > 1) {
              event.preventDefault()
              pasteFrom(index, pasted)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !value[index] && index > 0) {
              event.preventDefault()
              const next = Array.from({ length: 6 }, (_, slot) => value[slot] ?? "")
              next[index - 1] = ""
              onChange(next)
              inputs.current[index - 1]?.focus()
            }
            if (event.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus()
            if (event.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus()
          }}
        />
      ))}
    </div>
  )
}
