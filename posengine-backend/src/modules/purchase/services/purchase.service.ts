import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'

import { PrismaService } from '../../../prisma/prisma.service'
import { CreatePurchaseDto } from '../dto/purchase/create-purchase.dto'
import { UpdatePurchaseDto } from '../dto/purchase/update-purchase.dto'
import { PurchaseFilterDto } from '../dto/purchase/purchase-filter.dto'
import { PurchaseStatus } from '../../../generated/prisma/enums'
import { Prisma } from '../../../generated/prisma/client'
import { StockMovementService } from '../../stock-movement/stock-movement.service'
import { ProductService } from '../../product/product.service'

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly productService: ProductService,
  ) {}

  async generateInvoiceNumber(tenantId: string): Promise<{ invoiceNumber: string }> {
    let invoiceNumber: string
    let isUnique = false

    do {
      const randomNumber = Math.floor(Math.random() * 9_999_999) + 1
      const paddedNumber = String(randomNumber).padStart(7, '0')
      invoiceNumber = `001-001-${paddedNumber}`

      const existing = await this.prisma.purchase.findUnique({
        where: {
          invoiceNumber_tenantId: {
            invoiceNumber,
            tenantId,
          },
        },
      })

      isUnique = !existing
    } while (!isUnique)

    return { invoiceNumber }
  }

  async create(tenantId: string, cashSessionId: string, dto: CreatePurchaseDto) {
    const existing = await this.prisma.purchase.findUnique({
      where: {
        invoiceNumber_tenantId: {
          invoiceNumber: dto.invoiceNumber,
          tenantId,
        },
      },
    })

    if (existing) {
      throw new ConflictException(
        `Ya existe una compra con el número de factura "${dto.invoiceNumber}"`,
      )
    }

    const itemProductIds = dto.items.map((item) => item.productId)
    const uniqueProductIds = new Set(itemProductIds)
    if (uniqueProductIds.size !== itemProductIds.length) {
      throw new BadRequestException(
        'No puede haber productos duplicados en la misma compra',
      )
    }

    const productIds = Array.from(uniqueProductIds)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, name: true, unitType: true },
    })
    const productMap = new Map(products.map((product) => [product.id, product]))

    let calculatedTotal = 0
    for (const item of dto.items) {
      if (!Number.isFinite(item.quantity) || !Number.isFinite(item.unitCost)) {
        throw new BadRequestException(
          `El producto "${item.productId}" contiene valores numéricos inválidos`,
        )
      }

      if (item.quantity <= 0 || item.unitCost <= 0) {
        throw new BadRequestException(
          `El producto "${item.productId}" debe tener cantidad y costo mayores a 0`,
        )
      }

      const product = productMap.get(item.productId)
      if (!product) {
        throw new NotFoundException(`Producto con id "${item.productId}" no encontrado`)
      }

      this.productService.validateQuantity(item.quantity, product.unitType, product.name)
      calculatedTotal += item.quantity * item.unitCost
    }

    if (Math.abs(calculatedTotal - dto.total) > 1) {
      throw new BadRequestException(
        `El total de la compra no coincide con la suma de los items (${calculatedTotal} vs ${dto.total})`,
      )
    }

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          tenantId,
          cashSessionId,
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber,
          purchaseDate: new Date(dto.purchaseDate),
          paymentType: dto.paymentType,
          total: dto.total,
          notes: dto.notes,
          status: PurchaseStatus.RECEIVED,
        },
      })

      const productStocks = await tx.product.findMany({
        where: { id: { in: dto.items.map((item) => item.productId) }, tenantId },
        select: { id: true, stock: true },
      })
      const stockMap = new Map(productStocks.map((product) => [product.id, product.stock]))

      const purchaseItemsCreated = await Promise.all(
        dto.items.map(async (item) => {
          const before = stockMap.get(item.productId) ?? 0
          const after = before + item.quantity
          stockMap.set(item.productId, after)

          const purchaseItem = await tx.purchaseItem.create({
            data: {
              purchaseId: purchase.id,
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              total: item.quantity * item.unitCost,
            },
          })

          return {
            item,
            purchaseItemId: purchaseItem.id,
            before,
            after,
          }
        }),
      )

      await Promise.all(
        purchaseItemsCreated.map(async ({ item, purchaseItemId, before, after }) => {
          await Promise.all([
            tx.stockMovement.create({
              data: {
                tenantId,
                productId: item.productId,
                type: 'PURCHASE',
                quantity: item.quantity,
                before,
                after,
                referenceId: purchaseItemId,
                notes: 'Ingreso por compra',
                sourceType: 'PURCHASE',
              },
            }),
            tx.product.update({
              where: { id: item.productId },
              data: { stock: after },
            }),
          ])
        }),
      )

      return tx.purchase.findUnique({
        where: { id: purchase.id },
        include: {
          supplier: true,
          items: true,
        },
      })
    }, {
      timeout: 30_000,
      maxWait: 5_000,
    })
  }

  async findAll(tenantId: string, query: PurchaseFilterDto) {
    const { limit, skip, search, status, paymentType, dateFrom, dateTo, supplierId } = query

    const where: Prisma.PurchaseWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(paymentType && { paymentType }),
      ...(supplierId && { supplierId }),
      ...(search && {
        OR: [
          {
            invoiceNumber: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            supplier: {
              name: { contains: search, mode: Prisma.QueryMode.insensitive },
            },
          },
          {
            supplier: {
              RUC: { contains: search, mode: Prisma.QueryMode.insensitive },
            },
          },
        ],
      }),
      ...((dateFrom || dateTo) && {
        purchaseDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
        },
      }),
    }

    const [items, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: { supplier: true },
        orderBy: { purchaseDate: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.purchase.count({ where }),
    ])

    return { items, total, page: query.page, limit: query.limit }
  }

  async findOne(id: string, tenantId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId },
      include: {
        supplier: true,
        items: {
          include: {
            returnItems: {
              select: { quantity: true },
              where: { purchaseReturn: { status: 'CONFIRMED' } }
            },
            product: {
              select: { id: true, name: true, barcode: true, sku: true, stock: true }
            }
          }
        },
      },
    })

    if (!purchase) {
      throw new NotFoundException(`Compra con id "${id}" no encontrada`)
    }

    return purchase
  }
  
  async cancel(id: string, tenantId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, tenantId },
      include: {
        items: true,
        returns: true,
      },
    })

    if (!purchase) {
      throw new NotFoundException(`Compra con id "${id}" no encontrada`)
    }

    if (purchase.status === PurchaseStatus.CANCELLED) {
      throw new ConflictException('La compra ya está cancelada')
    }

    if (purchase.returns.length > 0) {
      throw new BadRequestException(
        'No se puede cancelar una compra que tiene devoluciones registradas',
      )
    }

    return this.prisma.$transaction(async (tx) => {
      // Revert stock for each item
      for (const item of purchase.items) {
        await this.stockMovementService.registerPurchaseCancellation(
          tenantId,
          item.productId,
          item.quantity,
          item.id,
          tx,
        )
      }

      return tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CANCELLED },
        include: { supplier: true },
      })
    })
  }
}
