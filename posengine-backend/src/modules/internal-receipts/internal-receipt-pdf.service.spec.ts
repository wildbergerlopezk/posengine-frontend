import { InternalReceiptPdfService } from './internal-receipt-pdf.service'
import sharp from 'sharp'

describe('InternalReceiptPdfService logo handling', () => {
  const uploadService = { getCompanyLogo: jest.fn() }
  let service: InternalReceiptPdfService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new InternalReceiptPdfService(uploadService as any)
  })

  const receipt = (logoUrl: string | null) => ({
    tenantId: '11111111-1111-4111-8111-111111111111',
    docNumber: 1,
    total: 100,
    createdAt: new Date('2026-01-01T12:00:00Z'),
    voided: false,
    snapshot: {
      company: {
        legalName: 'Empresa de prueba',
        tradeName: 'Prueba',
        address: 'Calle 1',
        city: 'Asunción',
        taxId: '80000000-0',
        logoUrl,
      },
      customer: null,
      sale: { id: 'sale-1', saleDate: '2026-01-01T12:00:00Z', status: 'COMPLETED', total: 100 },
      items: [{ productName: 'Producto', sku: 'P-1', quantity: 1, unitPrice: 100, priceType: 'PUBLIC', total: 100 }],
    },
  })

  it('generates a PDF without a logo when no owned image can be loaded', async () => {
    uploadService.getCompanyLogo.mockResolvedValue(null)

    const pdf = await service.generate(receipt('https://untrusted.example/logo.png') as any)

    expect(uploadService.getCompanyLogo).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'https://untrusted.example/logo.png',
    )
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
  })

  it('continues to render a legitimate uploaded tenant logo', async () => {
    uploadService.getCompanyLogo.mockResolvedValue(await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#17803d' },
    }).png().toBuffer())

    const pdf = await service.generate(receipt('https://storage.example/owned.webp') as any)

    expect(uploadService.getCompanyLogo).toHaveBeenCalledTimes(1)
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
  })
})
