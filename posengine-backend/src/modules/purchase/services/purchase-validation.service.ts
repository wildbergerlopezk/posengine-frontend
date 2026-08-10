import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ProductService } from '../../product/product.service'
import { CreatePurchaseDto } from '../dto/create-purchase.dto'
import { Prisma } from '../../../generated/prisma/client'

@Injectable()
export class PurchaseValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  async validateCreatePurchase(tenantId: string, dto: CreatePurchaseDto) {
    // 1. Validar proveedor multitenant
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, tenantId },
    })
    if (!supplier) {
      throw new NotFoundException(`Proveedor con id "${dto.supplierId}" no encontrado`)
    }

    // 2. Validar unicidad del número de factura
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

    // 3. Validar productos duplicados en el DTO
    const itemProductIds = dto.items.map((item) => item.productId)
    const uniqueProductIds = new Set(itemProductIds)
    if (uniqueProductIds.size !== itemProductIds.length) {
      throw new BadRequestException(
        'No puede haber productos duplicados en la misma compra',
      )
    }

    // 4. Validar que los productos existan y pertenezcan al tenant
    const productIds = Array.from(uniqueProductIds)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, name: true, unitType: true },
    })

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id)
      const missing = productIds.filter((id) => !foundIds.includes(id))
      throw new NotFoundException(
        `Los siguientes productos no fueron encontrados: ${missing.join(', ')}`,
      )
    }

    const productMap = new Map(products.map((product) => [product.id, product]))

    // 5. Validar formato de cantidades, valores numéricos y calcular total
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

      const product = productMap.get(item.productId)!
      this.productService.validateQuantity(item.quantity, product.unitType, product.name)
      calculatedTotal += item.quantity * item.unitCost
    }

    // 6. Validar total coincidente
    if (Math.abs(calculatedTotal - dto.total) > 1) {
      throw new BadRequestException(
        `El total de la compra no coincide con la suma de los items (${calculatedTotal} vs ${dto.total})`,
      )
    }

    this.validatePurchaseDebt(dto)

    return productIds
  }

  validatePurchaseDebt(dto: CreatePurchaseDto) {
    if (dto.paymentType === 'CASH' && dto.debt) {
      throw new BadRequestException('No se puede definir una deuda en una compra al contado')
    }

    if (dto.paymentType !== 'CREDIT') return

    if (!dto.debt) {
      throw new BadRequestException('Debe indicar los datos de la deuda para una compra a crédito')
    }

    if (dto.debt.scheduleType === 'NONE') {
      if (!dto.debt.dueDate) {
        throw new BadRequestException('Debe indicar una fecha límite de pago')
      }
      return
    }

    if (!dto.debt.installments?.length) {
      throw new BadRequestException('Debe indicar al menos una cuota')
    }

    const sum = dto.debt.installments.reduce((acc, i) => acc + i.amount, 0)
    if (Math.abs(sum - dto.total) > 1) {
      throw new BadRequestException(
        `La suma de las cuotas (${sum}) no coincide con el total de la compra (${dto.total})`,
      )
    }

    const numbers = dto.debt.installments.map((i) => i.number).sort((a, b) => a - b)
    numbers.forEach((n, idx) => {
      if (n !== idx + 1) {
        throw new BadRequestException('Las cuotas deben estar numeradas consecutivamente desde 1')
      }
    })
  }

  async validateCancelStockAvailability(
    tx: Prisma.TransactionClient,
    purchase: any,
    tenantId: string,
  ) {
    const productIds = purchase.items.map((item: any) => item.productId)
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, name: true, stock: true },
    })
    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const item of purchase.items) {
      const product = productMap.get(item.productId)
      if (!product || product.stock < item.quantity) {
        throw new BadRequestException(
          `No se puede cancelar la compra. El producto "${
            product?.name || item.productId
          }" tiene un stock de ${product?.stock || 0} unidades, pero la compra ingresó ${
            item.quantity
          } unidades. Parte de la mercadería ya fue vendida.`,
        )
      }
    }
  }
}
