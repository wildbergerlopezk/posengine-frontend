import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePurchaseReturnDto } from '../dto/create-purchase-return.dto';
import { PurchaseReturnStatus, PurchaseStatus } from '../../../generated/prisma/enums';
import { StockMovementService } from '../../stock-movement/stock-movement.service';

@Injectable()
export class PurchaseReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementService: StockMovementService,
  ) {}

  async create(tenantId: string, dto: CreatePurchaseReturnDto) {
    // 1. Verificar que la compra existe, pertenece al tenant y fue recibida
    const purchase = await this.prisma.purchase.findFirst({
      where: { id: dto.purchaseId, tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, stock: true } },
            returnItems: {
              where: {
                purchaseReturn: { status: PurchaseReturnStatus.CONFIRMED },
              },
            },
          },
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra con id "${dto.purchaseId}" no encontrada`);
    }

    if (purchase.status !== PurchaseStatus.RECEIVED) {
      throw new BadRequestException(
        'Solo se pueden devolver compras en estado RECEIVED',
      );
    }

    // 2. Validar cada ítem de la devolución
    const returnItemsData: {
      purchaseItemId: string
      productId: string
      quantity: number
      unitCost: number
      total: number
    }[] = []

    let returnTotal = 0

    for (const dtoItem of dto.items) {
      const purchaseItem = purchase.items.find(i => i.id === dtoItem.purchaseItemId)

      if (!purchaseItem) {
        throw new NotFoundException(
          `El ítem "${dtoItem.purchaseItemId}" no pertenece a esta compra`,
        )
      }

      // Cuánto ya fue devuelto de este ítem en devoluciones CONFIRMED anteriores
      const alreadyReturned = purchaseItem.returnItems.reduce((sum, r) => sum + r.quantity, 0)

      const availableToReturn = purchaseItem.quantity - alreadyReturned

      if (dtoItem.quantity > availableToReturn) {
        throw new BadRequestException(
          `Solo quedan ${availableToReturn} unidades disponibles para devolver de "${purchaseItem.product.name}"`,
        )
      }

      // ── REGLA PRINCIPAL: no se puede devolver lo que ya fue vendido ──────
      // El stock actual refleja exactamente las unidades físicamente disponibles.
      // Si stock < cantidad a devolver, significa que esas unidades ya salieron por ventas.
      if (purchaseItem.product.stock < dtoItem.quantity) {
        throw new BadRequestException(
          `No se puede devolver ${dtoItem.quantity} unidad/es de "${purchaseItem.product.name}". `
          + `El stock actual es ${purchaseItem.product.stock}, lo que significa que las unidades restantes ya fueron vendidas.`,
        )
      }

      const itemTotal = dtoItem.quantity * purchaseItem.unitCost
      returnTotal += itemTotal

      returnItemsData.push({
        purchaseItemId: dtoItem.purchaseItemId,
        productId: purchaseItem.productId,
        quantity: dtoItem.quantity,
        unitCost: purchaseItem.unitCost,
        total: itemTotal,
      })
    }

    // 3. Crear la devolución en estado PENDING (sin afectar stock todavía)
    const purchaseReturn = await this.prisma.purchaseReturn.create({
      data: {
        tenantId,
        purchaseId: dto.purchaseId,
        returnDate: new Date(dto.returnDate),
        reason: dto.reason,
        creditNoteNumber: dto.creditNoteNumber,
        total: returnTotal,
        status: PurchaseReturnStatus.PENDING,
        items: {
          create: returnItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    })

    return purchaseReturn
  }

  async confirm(returnId: string, tenantId: string) {
    // 1. Cargar la devolución con sus ítems
    const purchaseReturn = await this.prisma.purchaseReturn.findFirst({
      where: { id: returnId, tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, stock: true } },
          },
        },
        purchase: true,
      },
    })

    if (!purchaseReturn) {
      throw new NotFoundException(`Devolución con id "${returnId}" no encontrada`)
    }

    if (purchaseReturn.status !== PurchaseReturnStatus.PENDING) {
      throw new BadRequestException('Solo se pueden confirmar devoluciones en estado PENDING')
    }

    // 2. Re-validar la regla de negocio al momento de confirmar
    // (el stock pudo haber cambiado entre la creación y la confirmación)
    for (const item of purchaseReturn.items) {
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          `No se puede confirmar la devolución. `
          + `"${item.product.name}" tiene stock actual de ${item.product.stock} `
          + `pero se intentan devolver ${item.quantity} unidades. `
          + `Las unidades ya fueron vendidas.`,
        )
      }
    }

    // 3. Confirmar en transacción: descontar stock + actualizar estados
    return this.prisma.$transaction(async (tx) => {
      // Descontar stock de cada producto devuelto
      for (const item of purchaseReturn.items) {
        const before = item.product.stock
        const after = before - item.quantity

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId,
            type: 'MANUAL',
            sourceType: 'RETURN',
            quantity: -item.quantity,
            before,
            after,
            referenceId: returnId,
            notes: `Devolución de compra #${purchaseReturn.purchase.invoiceNumber}`,
          },
        })

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: after },
        })
      }

      // Actualizar estado de la devolución a CONFIRMED
      await tx.purchaseReturn.update({
        where: { id: returnId },
        data: { status: PurchaseReturnStatus.CONFIRMED },
      })

      // 4. Determinar si la compra queda totalmente devuelta o sigue recibida (parcial)
      // Obtenemos todos los items de la compra y comparamos con lo devuelto (incluyendo esta devolución)
      const allPurchaseItems = await tx.purchaseItem.findMany({
        where: { purchaseId: purchaseReturn.purchaseId },
        include: {
          returnItems: {
            where: {
              purchaseReturn: {
                OR: [
                  { status: PurchaseReturnStatus.CONFIRMED },
                  { id: returnId } // Incluimos la actual que estamos confirmando
                ]
              }
            }
          }
        }
      })

      const isFullyReturned = allPurchaseItems.every(item => {
        const returnedQty = item.returnItems.reduce((sum, r) => sum + r.quantity, 0)
        return returnedQty >= item.quantity
      })

      if (isFullyReturned) {
        await tx.purchase.update({
          where: { id: purchaseReturn.purchaseId },
          data: { status: PurchaseStatus.FULLY_RETURNED },
        })
      }

      return tx.purchaseReturn.findUnique({
        where: { id: returnId },
        include: {
          items: {
            include: { product: { select: { id: true, name: true } } },
          },
          purchase: { select: { invoiceNumber: true, status: true } },
        },
      })
    })
  }

  async cancel(returnId: string, tenantId: string) {
    const purchaseReturn = await this.prisma.purchaseReturn.findFirst({
      where: { id: returnId, tenantId },
    })

    if (!purchaseReturn) {
      throw new NotFoundException(`Devolución con id "${returnId}" no encontrada`)
    }

    if (purchaseReturn.status !== PurchaseReturnStatus.PENDING) {
      throw new BadRequestException('Solo se pueden cancelar devoluciones en estado PENDING')
    }

    return this.prisma.purchaseReturn.update({
      where: { id: returnId },
      data: { status: PurchaseReturnStatus.CANCELLED },
    })
  }

  async findAll(tenantId: string, purchaseId?: string) {
    return this.prisma.purchaseReturn.findMany({
      where: {
        tenantId,
        ...(purchaseId && { purchaseId }),
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        purchase: {
          select: { invoiceNumber: true, supplier: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(returnId: string, tenantId: string) {
    const result = await this.prisma.purchaseReturn.findFirst({
      where: { id: returnId, tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } },
            purchaseItem: { select: { quantity: true, unitCost: true } },
          },
        },
        purchase: {
          select: {
            invoiceNumber: true,
            purchaseDate: true,
            supplier: { select: { name: true, RUC: true } },
          },
        },
      },
    })

    if (!result) {
      throw new NotFoundException(`Devolución con id "${returnId}" no encontrada`)
    }

    return result
  }
}
