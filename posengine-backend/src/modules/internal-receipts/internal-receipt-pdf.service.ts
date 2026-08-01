// src/internal-receipts/internal-receipt-pdf.service.ts
//
// Dibuja el PDF del comprobante interno a partir del snapshot ya
// persistido (InternalReceiptSnapshot). Corre en el backend (Node),
// no depende del navegador.

import { Injectable } from '@nestjs/common'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { InternalReceiptSnapshot } from './internal-receipt.service'

interface ReceiptForPdf {
  docNumber: number
  total: number
  createdAt: Date | string
  voided: boolean
  voidedReason?: string | null
  snapshot: InternalReceiptSnapshot
}

const money = (n: number) =>
  n.toLocaleString('es-PY', { maximumFractionDigits: 0 })

@Injectable()
export class InternalReceiptPdfService {
  async generate(receipt: ReceiptForPdf): Promise<Buffer> {
    const { company } = receipt.snapshot

    // Fetch and convert logo image to Base64 if logoUrl exists
    let logoBase64: string | null = null
    if (company.logoUrl) {
      try {
        const response = await fetch(company.logoUrl)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        logoBase64 = buffer.toString('base64')
      } catch (error) {
        console.error('Error fetching company logo:', error)
      }
    }

    // A4 en orientación horizontal (landscape)
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })

    // Ancho de la página: 297 mm, Alto: 210 mm
    // Renderiza ORIGINAL en el lado izquierdo y DUPLICADO en el derecho
    this.drawReceiptPage(doc, receipt, logoBase64, 'ORIGINAL', 6)
    this.drawReceiptPage(doc, receipt, logoBase64, 'DUPLICADO', 153)

    // Línea de corte punteada entre las dos copias
    this.drawCutLine(doc)

    return Buffer.from(doc.output('arraybuffer'))
  }

  private drawCutLine(doc: jsPDF) {
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 6
    const centerX = pageWidth / 2

    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.2)
    doc.setLineDashPattern([1.5, 1.5], 0)

    doc.line(centerX, margin, centerX, pageHeight - margin)

    doc.setLineDashPattern([], 0)
    doc.setDrawColor(0, 0, 0)
  }

  private drawReceiptPage(
    doc: jsPDF,
    receipt: ReceiptForPdf,
    logoBase64: string | null,
    copyType: 'ORIGINAL' | 'DUPLICADO',
    startX: number
  ) {
    const { company, customer, sale, items } = receipt.snapshot
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 6
    const boxWidth = 138
    const boxHeight = pageHeight - margin * 2
    const endX = startX + boxWidth

    // Caja exterior que envuelve cada comprobante
    doc.setDrawColor(0)
    doc.rect(startX, margin, boxWidth, boxHeight)

    let y = margin + 6

    // ── Header: empresa (izquierda) + tipo de doc (derecha) ─────────────
    let textX = startX + 3
    if (logoBase64) {
      const logoSize = 14 // 14mm
      try {
        doc.addImage(logoBase64, 'PNG', startX + 3, y - 4, logoSize, logoSize)
        textX += logoSize + 4
      } catch (err) {
        console.error('Error adding logo to PDF:', err)
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(company.tradeName || company.legalName, textX, y)

    doc.setFontSize(9)
    doc.text('COMPROBANTE DE CONTROL INTERNO', endX - 3, y, {
      align: 'right',
    })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    y += 5
    doc.text(company.address, textX, y)
    doc.text(`Nro: ${String(receipt.docNumber).padStart(7, '0')}`, endX - 3, y, {
      align: 'right',
    })

    y += 4
    doc.text(`${company.city}${company.state ? ', ' + company.state : ''}`, textX, y)
    doc.text(
      new Date(receipt.createdAt).toLocaleString('es-PY'),
      endX - 3,
      y,
      { align: 'right' },
    )

    y += 4
    if (company.phone) doc.text(`Tel: ${company.phone}`, textX, y)

    y += 4
    doc.text(`RUC: ${company.taxId}`, textX, y)

    y += 4
    doc.setTextColor(180, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('DOCUMENTO SIN VALIDEZ FISCAL - NO VÁLIDO COMO FACTURA', endX - 3, y, {
      align: 'right',
    })
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')

    y += 4
    doc.line(startX, y, endX, y)
    y += 2

    // ── Fila: estado de venta / fecha de venta ──────────────────────────
    autoTable(doc, {
      startY: y,
      margin: { left: startX, right: pageWidth - endX },
      body: [[
        `Estado venta: ${sale.status}`,
        `Fecha de venta: ${new Date(sale.saleDate).toLocaleString('es-PY')}`,
      ]],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
    })
    y = (doc as any).lastAutoTable.finalY + 1

    // ── Fila: datos del cliente ──────────────────────────────────────────
    const customerLine = customer
      ? `Cliente: ${customer.name}${customer.taxId ? '  RUC: ' + customer.taxId : ''}${
          customer.documentNumber ? '  CI: ' + customer.documentNumber : ''
        }`
      : 'Cliente: Consumidor final'

    autoTable(doc, {
      startY: y,
      margin: { left: startX, right: pageWidth - endX },
      body: [[customerLine]],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
    })
    y = (doc as any).lastAutoTable.finalY + 2

    // ── Tabla de items ────────────────────────────────────────────────────
    autoTable(doc, {
      startY: y,
      margin: { left: startX, right: pageWidth - endX },
      head: [['Codigo interno', 'Cant.', 'Descripción', 'Precio', 'Total']],
      body: items.map((item) => [
        item.sku ?? '-',
        String(item.quantity),
        item.productName,
        money(item.unitPrice),
        money(item.total),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.2 },
      styles: { fontSize: 8, cellPadding: 1.5, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
      columnStyles: {
        1: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    })
    y = (doc as any).lastAutoTable.finalY + 4

    // ── Totales ───────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(`TOTAL Gs. ${money(receipt.total)}`, endX - 3, y, {
      align: 'right',
    })
    doc.setFont('helvetica', 'normal')

    if (receipt.voided) {
      doc.setFontSize(20)
      doc.setTextColor(180, 0, 0)
      doc.setFont('helvetica', 'bold')
      doc.text('ANULADO', startX + boxWidth / 2, y + 20, { align: 'center', angle: 15 })
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'normal')
    }

    // Etiqueta de ORIGINAL / DUPLICADO centrada cerca de la parte inferior
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text(`- ${copyType} -`, startX + boxWidth / 2, pageHeight - margin - 15, { align: 'center' })
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')

    // ── Footer ────────────────────────────────────────────────────────────
    const footerY = pageHeight - margin - 8
    doc.setFontSize(6.5)
    doc.setTextColor(90, 90, 90)
    doc.text(
      'Este comprobante es de uso interno y no reemplaza la factura legal electrónica.',
      startX + boxWidth / 2,
      footerY,
      { align: 'center' },
    )
    doc.text(
      'Será reemplazado por el KuDE oficial una vez habilitada la integración con e-Kuatía.',
      startX + boxWidth / 2,
      footerY + 3,
      { align: 'center' },
    )
  }
}
