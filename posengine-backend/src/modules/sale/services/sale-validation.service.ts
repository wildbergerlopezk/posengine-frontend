import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { ProductService } from '../../product/product.service'
import { CreateSaleDto } from '../dto/create-sale.dto'
import { PriceType } from '../../../generated/prisma/enums'

@Injectable()
export class SaleValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  async validateAndFetchProducts(tenantId: string, items: CreateSaleDto['items']) {
    const productIds = items.map((i) => i.productId)
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

    const productMap = new Map(products.map((p) => [p.id, p]))

    for (const item of items) {
      const product = productMap.get(item.productId)!

      if (!product.isActive) {
        throw new BadRequestException(
          `El producto "${product.name}" está inactivo y no puede venderse.`,
        )
      }

      this.productService.validateQuantity(item.quantity, product.unitType, product.name)

      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}.`,
        )
      }

      const basePrice = item.priceType === PriceType.WHOLESALE
        ? product.wholesalePrice
        : product.price

      if (item.unitPrice < basePrice) {
        throw new BadRequestException(
          `El precio de "${product.name}" no puede ser menor al precio ${
            item.priceType === PriceType.WHOLESALE ? 'mayorista' : 'público'
          } (Gs. ${basePrice.toLocaleString('es-PY')}). Recibido: Gs. ${item.unitPrice.toLocaleString('es-PY')}.`,
        )
      }
    }

    return products
  }

  validateStockAndActiveState(items: any[]) {
    for (const item of items) {
      if (!item.product.isActive) {
        throw new BadRequestException(
          `El producto "${item.product.name}" está inactivo y no puede restaurarse en la venta.`,
        )
      }
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para restaurar la venta. El producto "${item.product.name}" tiene ${item.product.stock} unidades disponibles, pero la venta requiere ${item.quantity}.`,
        )
      }
    }
  }
}
