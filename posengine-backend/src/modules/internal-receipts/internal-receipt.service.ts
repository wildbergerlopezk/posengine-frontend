import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CompanyService } from '../company/company.service'
import { CustomerService } from '../customer/customer.service'
import { SaleService } from '../sale/services/sale.service'
import { CreateInternalReceiptDto } from './dto/create-internal-receipt.dto'
import { InternalReceiptFilterDto } from './dto/internal-receipt-filter.dto'

// Foto congelada al momento de emitir el comprobante. Esto es lo que
// se guarda en la columna `snapshot` y lo que consume el frontend
// (@react-pdf/renderer) para pintar el PDF, sin volver a pedir nada más.
export interface InternalReceiptSnapshot {
  company: {
    legalName: string
    tradeName?: string | null
    address: string
    city: string
    state?: string | null
    phone?: string | null
    email?: string | null
    economicActivity?: string | null
    logoUrl?: string | null
    taxId: string
  }
  customer: {
    name: string
    taxId?: string | null
    documentNumber?: string | null
    phone?: string | null
    email?: string | null
    address?: string | null
  } | null
  sale: {
    id: string
    saleDate: string
    status: string
    total: number
  }
  items: Array<{
    productName: string
    sku: string | null
    quantity: number
    unitPrice: number
    priceType: string
    total: number
  }>
}

@Injectable()
export class InternalReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyService: CompanyService,
    private readonly customerService: CustomerService,
    private readonly saleService: SaleService,
  ) {}

  // ── Create (emitir) ───────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateInternalReceiptDto) {
    const existing = await this.prisma.internalReceipt.findUnique({
      where: { saleId: dto.saleId },
    })
    if (existing) {
      throw new ConflictException(
        `La venta "${dto.saleId}" ya tiene un comprobante interno emitido (Nro ${existing.docNumber})`,
      )
    }

    // findOne de cada service ya valida tenantId y tira NotFoundException
    const [company, sale] = await Promise.all([
      this.companyService.findOne(dto.companyId, tenantId),
      this.saleService.findOne(dto.saleId, tenantId),
    ])

    if (sale.status === 'CANCELLED') {
      throw new BadRequestException(
        'No se puede emitir un comprobante interno para una venta anulada',
      )
    }

    let customerSnapshot: InternalReceiptSnapshot['customer'] = null
    if (dto.customerId) {
      const c = await this.customerService.findOne(dto.customerId, tenantId)
      customerSnapshot = {
        name: c.name,
        taxId: c.taxId,
        documentNumber: c.documentNumber,
        phone: c.phone,
        email: c.email,
        address: c.address,
      }
    }

    const snapshot: InternalReceiptSnapshot = {
      company: {
        legalName: company.legalName,
        tradeName: company.tradeName,
        address: company.address,
        city: company.city,
        state: company.state,
        phone: company.phone,
        email: company.email,
        economicActivity: company.economicActivity,
        logoUrl: company.logoUrl,
        taxId: company.taxId,
      },
      customer: customerSnapshot,
      sale: {
        id: sale.id,
        saleDate: sale.saleDate.toString(),
        status: sale.status,
        total: sale.total,
      },
      items: sale.items.map((item: any) => ({
        productName: item.product.name,
        sku: item.product.sku ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        priceType: item.priceType,
        total: item.total,
      })),
    }

    // Transacción: calcular el próximo correlativo y crear el registro juntos,
    // para minimizar la ventana de carrera entre el max() y el create().
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.internalReceipt.findFirst({
        where: { companyId: dto.companyId },
        orderBy: { docNumber: 'desc' },
        select: { docNumber: true },
      })
      const nextDocNumber = (last?.docNumber ?? 0) + 1

      return tx.internalReceipt.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          saleId: dto.saleId,
          customerId: dto.customerId,
          docNumber: nextDocNumber,
          total: sale.total,
          snapshot: snapshot as any,
        },
      })
    })
  }

  // ── FindAll ────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: InternalReceiptFilterDto) {
    const { companyId, saleId, voided, dateFrom, dateTo, page = 1, limit = 20 } = filters
    const skip = (page - 1) * limit

    const where: any = { tenantId }
    if (companyId) where.companyId = companyId
    if (saleId) where.saleId = saleId
    if (voided !== undefined) where.voided = voided
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.internalReceipt.findMany({
        where,
        orderBy: { docNumber: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.internalReceipt.count({ where }),
    ])

    return { items, total, page, limit }
  }

  // ── FindOne ────────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    const receipt = await this.prisma.internalReceipt.findFirst({
      where: { id, tenantId },
    })
    if (!receipt) {
      throw new NotFoundException(`Comprobante interno con id "${id}" no encontrado`)
    }
    return receipt
  }

  // ── Void (anular el comprobante, no la venta) ────────────────────────────
  async void(id: string, tenantId: string, reason?: string) {
    const receipt = await this.findOne(id, tenantId)

    if (receipt.voided) {
      throw new ConflictException('El comprobante ya está anulado')
    }

    return this.prisma.internalReceipt.update({
      where: { id },
      data: {
        voided: true,
        voidedAt: new Date(),
        voidedReason: reason,
      },
    })
  }
}
