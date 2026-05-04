// src/sales/sale.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger'
import { SaleService } from '../services/sale.service'
import { CreateSaleDto } from './../dto/create-sale.dto'
import { SaleFilterDto } from './../dto/sale-filter.dto'
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../../common/decorators/current-user.decorator'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../generated/prisma/enums'

@ApiTags('Sales')
@ApiBearerAuth('access-token')
@Controller('sales')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una nueva venta' })
  @ApiBody({ type: CreateSaleDto })
  @ApiResponse({ status: 201, description: 'Venta registrada correctamente' })
  @ApiResponse({ status: 400, description: 'Sin caja abierta, stock insuficiente o precio inválido' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaleDto,
  ) {
    return this.saleService.create(user.tenantId, dto)
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar ventas con filtros y paginación' })
  @ApiResponse({ status: 200, description: 'Lista de ventas' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: SaleFilterDto,
  ) {
    return this.saleService.findAll(tenantId, query)
  }

  @Get('by-session/:cashSessionId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener todas las ventas de una sesión de caja' })
  @ApiParam({ name: 'cashSessionId', description: 'ID de la sesión de caja' })
  @ApiResponse({ status: 200, description: 'Ventas de la sesión' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  findByCashSession(
    @Param('cashSessionId') cashSessionId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.saleService.findByCashSession(cashSessionId, tenantId)
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener venta por ID' })
  @ApiParam({ name: 'id', description: 'ID de la venta' })
  @ApiResponse({ status: 200, description: 'Venta encontrada' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.saleService.findOne(id, tenantId)
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Anular una venta' })
  @ApiParam({ name: 'id', description: 'ID de la venta' })
  @ApiResponse({ status: 200, description: 'Venta anulada correctamente' })
  @ApiResponse({ status: 404, description: 'Venta no encontrada' })
  @ApiResponse({ status: 409, description: 'La venta ya fue anulada' })
  cancel(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.saleService.cancel(id, tenantId)
  }
}
