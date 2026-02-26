"use client"

import { useCallback } from "react"

export function useFormatCurrency(currency = "ARS") {
  const formatCurrency = useCallback(
    (value: number) => {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
      }).format(value)
    },
    [currency],
  )

  return formatCurrency
}

export function formatCurrency(value: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(value)
}
