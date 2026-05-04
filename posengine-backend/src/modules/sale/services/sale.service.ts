// src/sales/sale.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { StockMovementService } from '../../../stock-movement/stock-movement.service'
import { ProductService } from '../../product/product.service'
import { CreateSaleDto } from './../dto/create-sale.dto'
import { SaleFilterDto } from './../dto/sale-filter.dto'
import { CashSessionStatus, SaleStatus } from '../../../generated/prisma/enums'
import { Prisma } from '../../../generated/prisma/client'

@Injectable()
export class SaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
    private readonly productService: ProductService,
  ) {}

  // ── Create ───────────────────────────────────────────────────────────────
  async create(tenantId: string, dto: CreateSaleDto) {
    // 1. Verificar que existe sesión de caja abierta
    const cashSession = await this.prisma.cashSession.findFirst({
      where: { tenantId, status: CashSessionStatus.OPEN },
    })
    if (!cashSession) {
      throw new BadRequestException(
        'No hay una caja abierta. Realizá la apertura de caja antes de registrar ventas.',
      )
    }

    // 2. Validar que no haya productId duplicado en el mismo request
    const productIds = dto.items.map((i) => i.productId)
    const uniqueIds = new Set(productIds)
    if (uniqueIds.size !== productIds.length) {
      throw new BadRequestException(
        'No puede haber productos duplicados en la misma venta. Sumá las cantidades en un solo item.',
      )
    }

    // 3. Cargar todos los productos de una sola consulta
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
    })

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id)
      const missing = productIds.filter((id) => !foundIds.includes(id))
      throw new NotFoundException(
        `Los siguientes productos no fueron encontrados: ${missing.join(', ')}`,
      )
    }

    // 4. Validaciones por item
    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const item of dto.items) {
      const product = productMap.get(item.productId)!

      // 4a. Producto activo
      if (!product.isActive) {
        throw new BadRequestException(
          `El producto "${product.name}" está inactivo y no puede venderse.`,
        )
      }

      // 4b. Cantidad válida según unitType (entero para UNIT, float para el resto)
      this.productService.validateQuantity(item.quantity, product.unitType, product.name)

      // 4c. Stock suficiente
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}.`,
        )
      }

      // 4d. Precio no puede ser menor al precio base del producto
      if (item.unitPrice < product.price) {
        throw new BadRequestException(
          `El precio de "${product.name}" no puede ser menor al precio base (Gs. ${product.price.toLocaleString('es-PY')}). Recibido: Gs. ${item.unitPrice.toLocaleString('es-PY')}.`,
        )
      }
    }

    // 5. Calcular total de la venta
    const total = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    )

    // 6. Crear la venta, sus items y los movimientos de stock en una transacción
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          tenantId,
          cashSessionId: cashSession.id,
          total,
        },
      })

      for (const item of dto.items) {
        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          },
        })

        // Descontar stock y registrar movimiento
        await this.stockMovementService.registerSale(
          tenantId,
          item.productId,
          item.quantity,
          saleItem.id,
          tx,
        )
      }

      // Actualizar totalSales de la sesión de caja activa
      await tx.cashSession.update({
        where: { id: cashSession.id },
        data: { totalSales: { increment: total } },
      })

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unitType: true } },
            },
          },
        },
      })
    })
  }

  // ── FindAll ──────────────────────────────────────────────────────────────
  async findAll(tenantId: string, query: SaleFilterDto) {
    const { status, dateFrom, dateTo, cashSessionId, page = 1, limit = 20 } = query
    const skip = (page - 1) * limit

    const where: Prisma.SaleWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(cashSessionId && { cashSessionId }),
      ...((dateFrom || dateTo) && {
        saleDate: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(`${dateTo}T23:59:59.999Z`) }),
        },
      }),
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unitType: true } },
            },
          },
        },
        orderBy: { saleDate: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.sale.count({ where }),
    ])

    return { items, total, page, limit }
  }

  // ── FindOne ──────────────────────────────────────────────────────────────
  async findOne(id: string, tenantId: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, tenantId },
      include: {
        cashSession: {
          select: { id: true, openedAt: true, closedAt: true, status: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, barcode: true, unitType: true },
            },
          },
        },
      },
    })

    if (!sale) {
      throw new NotFoundException(`Venta con id "${id}" no encontrada`)
    }

    return sale
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  async cancel(id: string, tenantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, tenantId },
        include: {
          cashSession: true,
          items: true,
        },
      })

      if (!sale) {
        throw new NotFoundException(`Venta con id "${id}" no encontrada`)
      }

      if (sale.status === SaleStatus.CANCELLED) {
        throw new ConflictException('La venta ya está anulada')
      }

      const statusUpdate = await tx.sale.updateMany({
        where: { id, tenantId, status: SaleStatus.COMPLETED },
        data: { status: SaleStatus.CANCELLED },
      })

      if (statusUpdate.count === 0) {
        throw new ConflictException('La venta ya está anulada')
      }

      for (const item of sale.items) {
        await this.stockMovementService.registerSaleCancellation(
          tenantId,
          item.productId,
          item.quantity,
          item.id,
          tx,
        )
      }

      const adjustedTotalSales = Math.max(0, sale.cashSession.totalSales - sale.total)
      const cashSessionUpdate: Prisma.CashSessionUpdateInput = {
        totalSales: adjustedTotalSales,
      }

      if (sale.cashSession.closingAmount !== null) {
        const expectedAmount =
          sale.cashSession.openingAmount +
          adjustedTotalSales -
          sale.cashSession.totalPurchases

        cashSessionUpdate.expectedAmount = expectedAmount
        cashSessionUpdate.difference =
          sale.cashSession.closingAmount - expectedAmount
      }

      await tx.cashSession.update({
        where: { id: sale.cashSessionId },
        data: cashSessionUpdate,
      })

      return tx.sale.findUnique({
        where: { id },
        include: {
          cashSession: {
            select: { id: true, openedAt: true, closedAt: true, status: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true, unitType: true },
              },
            },
          },
        },
      })
    })
  }

  // ── FindByCashSession ────────────────────────────────────────────────────
  // Útil para mostrar las ventas del día en el resumen de cierre
  async findByCashSession(cashSessionId: string, tenantId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: cashSessionId, tenantId },
    })
    if (!session) {
      throw new NotFoundException(`Sesión de caja "${cashSessionId}" no encontrada`)
    }

    return this.prisma.sale.findMany({
      where: { cashSessionId, tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, unitType: true } },
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    })
  }
}
