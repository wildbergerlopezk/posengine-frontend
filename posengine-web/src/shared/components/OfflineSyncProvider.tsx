"use client"

import { useEffect, useState } from "react"
import { WifiOff, TriangleAlert } from "lucide-react"

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)

  // Initialize online state on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine)
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return (
    <>
      {!isOnline && (
        <div style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          backgroundColor: "#f59e0b",
          color: "#fff",
          padding: "0.75rem 1rem",
          borderRadius: "0.5rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          zIndex: 9999,
          fontSize: "0.875rem",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          maxWidth: "340px",
          border: "1px solid rgba(255,255,255,0.2)",
        }}>
          <WifiOff size={18} style={{ flexShrink: 0, marginTop: "0.15rem" }} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Sin conexión a internet</div>
            <div style={{ fontSize: "0.75rem", opacity: 0.95, lineHeight: "1.2rem", marginBottom: "0.5rem" }}>
              Por favor, verifica tu conexión de red. Algunas funcionalidades y búsquedas no estarán disponibles.
            </div>
            <div style={{ 
              fontSize: "0.72rem", 
              backgroundColor: "rgba(0,0,0,0.15)", 
              padding: "0.4rem 0.6rem", 
              borderRadius: "0.25rem",
              lineHeight: "1.1rem",
              display: "flex",
              alignItems: "flex-start",
              gap: "0.35rem"
            }}>
              <TriangleAlert size={14} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
              <span>
                <strong>Modo Lectura/Consulta:</strong> El sistema reconectará automáticamente cuando se restablezca la señal de internet.
              </span>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
