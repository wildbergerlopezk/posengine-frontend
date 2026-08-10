import {
  Controller, Get, Post, Patch, Param,
  Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiBearerAuth, ApiBody, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { CreatePurchaseReturnDto } from '../dto/create-purchase-return.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../generated/prisma/enums';

@ApiTags('Purchase Returns')
@ApiBearerAuth('access-token')
@Controller('purchase-returns')
export class PurchaseReturnController {
  constructor(private readonly purchaseReturnService: PurchaseReturnService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una devolución de compra (en estado PENDING)' })
  @ApiBody({ type: CreatePurchaseReturnDto })
  @ApiResponse({ status: 201, description: 'Devolución creada, pendiente de confirmación' })
  @ApiResponse({ status: 400, description: 'Unidades ya vendidas o cantidad inválida' })
  @ApiResponse({ status: 404, description: 'Compra o ítem no encontrado' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreatePurchaseReturnDto,
  ) {
    return this.purchaseReturnService.create(tenantId, dto);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Confirmar devolución — descuenta stock y actualiza estado de compra' })
  @ApiParam({ name: 'id', description: 'ID de la devolución' })
  @ApiResponse({ status: 200, description: 'Devolución confirmada, stock actualizado' })
  @ApiResponse({ status: 400, description: 'Unidades ya vendidas al momento de confirmar' })
  confirm(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseReturnService.confirm(id, tenantId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cancelar una devolución PENDING — sin efecto en stock' })
  @ApiParam({ name: 'id', description: 'ID de la devolución' })
  @ApiResponse({ status: 200, description: 'Devolución cancelada' })
  cancel(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseReturnService.cancel(id, tenantId);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar devoluciones del tenant' })
  @ApiQuery({ name: 'purchaseId', required: false, description: 'Filtrar por compra' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query('purchaseId') purchaseId?: string,
  ) {
    return this.purchaseReturnService.findAll(tenantId, purchaseId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener detalle de una devolución' })
  @ApiParam({ name: 'id', description: 'ID de la devolución' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseReturnService.findOne(id, tenantId);
  }
}
