import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePurchaseItemDto } from '../dto/item/create-purchase-item.dto';
import { PurchaseStatus } from '../../../generated/prisma/enums';

@Injectable()
export class PurchaseItemService {
  constructor(private readonly prisma: PrismaService) {}

  async bulkCreate(
    purchaseId: string,
    tenantId: string,
    items: CreatePurchaseItemDto[],
  ) {
    // 1. Verificar que la compra existe y pertenece al tenant
    const purchase = await this.prisma.purchase.findFirst({
      where: { id: purchaseId, tenantId },
      include: { items: true },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra con id "${purchaseId}" no encontrada`);
    }

    // 2. Solo se pueden cargar items en compras PENDING
    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException(
        'Solo se pueden agregar items a compras en estado PENDING',
      );
    }

    // 3. Validar que no haya productId duplicado dentro del mismo request
    const productIds = items.map((i) => i.productId);
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      throw new BadRequestException(
        'No puede haber productos duplicados en la misma carga',
      );
    }

    // 4. Verificar que los productos existen y pertenecen al tenant
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId,
      },
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missing = productIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Los siguientes productos no fueron encontrados: ${missing.join(', ')}`,
      );
    }

    // 5. Verificar que ninguno de esos productos ya esté cargado en esta compra
    if (purchase.items.length > 0) {
      const existingProductIds = purchase.items.map((i) => i.productId);
      const conflicts = productIds.filter((id) =>
        existingProductIds.includes(id),
      );
      if (conflicts.length > 0) {
        throw new ConflictException(
          `Los siguientes productos ya están cargados en esta compra: ${conflicts.join(', ')}`,
        );
      }
    }

    // 6. Validar que los totales individuales sean consistentes (tolerancia de redondeo)
    for (const item of items) {
      const expected = item.quantity * item.unitCost;
      const diff = Math.abs(expected - item.total);
      if (diff > 1) {
        throw new BadRequestException(
          `El total del producto "${item.productId}" no coincide con quantity * unitCost (esperado: ${expected}, recibido: ${item.total})`,
        );
      }
    }

    // 7. Crear los items en una transacción
    const createdItems = await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.purchaseItem.create({
          data: {
            purchaseId,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            total: item.total,
          },
          include: {
            product: true,
          },
        }),
      ),
    );

    return {
      purchaseId,
      itemsCreated: createdItems.length,
      items: createdItems,
    };
  }

  async findAllByPurchase(purchaseId: string, tenantId: string) {
    // Verificar que la compra existe y pertenece al tenant
    const purchase = await this.prisma.purchase.findFirst({
      where: { id: purchaseId, tenantId },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra con id "${purchaseId}" no encontrada`);
    }

    return this.prisma.purchaseItem.findMany({
      where: { purchaseId },
      include: { product: true },
    });
  }

  async remove(itemId: string, purchaseId: string, tenantId: string) {
    // Verificar que la compra existe, pertenece al tenant y está PENDING
    const purchase = await this.prisma.purchase.findFirst({
      where: { id: purchaseId, tenantId },
    });

    if (!purchase) {
      throw new NotFoundException(`Compra con id "${purchaseId}" no encontrada`);
    }

    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException(
        'Solo se pueden eliminar items de compras en estado PENDING',
      );
    }

    // Verificar que el item existe y pertenece a esta compra
    const item = await this.prisma.purchaseItem.findFirst({
      where: { id: itemId, purchaseId },
    });

    if (!item) {
      throw new NotFoundException(`Item con id "${itemId}" no encontrado en esta compra`);
    }

    await this.prisma.purchaseItem.delete({ where: { id: itemId } });

    return { message: 'Item eliminado correctamente' };
  }
}