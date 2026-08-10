import { toast } from "sonner"

const LOCAL_PRINT_SERVER_URL = "http://localhost:3009"

/**
 * Checks if the local print server is running.
 */
export async function checkLocalPrintServer(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_PRINT_SERVER_URL}/status`, {
      method: "GET",
      signal: AbortSignal.timeout(1000), // timeout fast
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Prints a PDF from a blob, trying the local print server first.
 * If the local server is not active, falls back to iframe browser print.
 */
export async function printPdfBlob(blob: Blob, filename = "document.pdf"): Promise<void> {
  const isServerActive = await checkLocalPrintServer()

  if (isServerActive) {
    // Send to local print server for silent direct printing
    try {
      const formData = new FormData()
      formData.append("file", blob, filename)

      const res = await fetch(`${LOCAL_PRINT_SERVER_URL}/print`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        throw new Error("El servidor de impresión local falló al imprimir.")
      }

      toast.success("Enviado a la ticketera física silenciosamente.")
      return
    } catch (err: any) {
      console.error("Local print server error:", err)
      toast.warning("Fallo en la ticketera local. Usando impresión de navegador...")
    }
  }

  // Fallback: Browser printing via iframe
  const pdfUrl = URL.createObjectURL(blob)
  
  // Create temp iframe
  const iframe = document.createElement("iframe")
  iframe.style.position = "fixed"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "none"
  iframe.src = `${pdfUrl}#toolbar=0&navpanes=0`

  document.body.appendChild(iframe)

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      // Cleanup after some time
      setTimeout(() => {
        if (iframe.parentNode) {
          document.body.removeChild(iframe)
        }
        URL.revokeObjectURL(pdfUrl)
      }, 5000)
    } catch (err) {
      console.error("Iframe print error:", err)
      window.open(pdfUrl, "_blank")
    }
  }
}
