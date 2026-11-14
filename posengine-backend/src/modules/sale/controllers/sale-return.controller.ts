import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../generated/prisma/enums'
import { ConfirmSaleReturnDto, CreateSaleReturnDto, SettleSaleReturnRefundDto } from '../dto/create-sale-return.dto'
import { SaleReturnService } from '../services/sale-return.service'

@ApiTags('Sale Returns')
@ApiBearerAuth('access-token')
@Controller('sale-returns')
export class SaleReturnController {
  constructor(private readonly saleReturnService: SaleReturnService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una devolución de venta pendiente' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateSaleReturnDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.saleReturnService.create(tenantId, actorId, dto, idempotencyKey)
  }

  @Get('by-sale/:saleId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar devoluciones vinculadas a una venta' })
  findBySale(@Param('saleId') saleId: string, @CurrentUser('tenantId') tenantId: string) {
    return this.saleReturnService.findBySale(saleId, tenantId)
  }

  @Patch(':id/confirm')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Confirmar devolución, ajustar deuda y reingresar únicamente mercancía apta' })
  confirm(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: ConfirmSaleReturnDto,
  ) {
    return this.saleReturnService.confirm(id, tenantId, actorId, dto)
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cancelar una devolución pendiente' })
  cancel(@Param('id') id: string, @CurrentUser('tenantId') tenantId: string) {
    return this.saleReturnService.cancel(id, tenantId)
  }

  @Patch('settlements/:settlementId/settle')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Registrar un reembolso parcial o completo al cliente' })
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  settleRefund(
    @Param('settlementId') settlementId: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: SettleSaleReturnRefundDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.saleReturnService.settleRefund(settlementId, tenantId, actorId, dto, idempotencyKey)
  }
}
