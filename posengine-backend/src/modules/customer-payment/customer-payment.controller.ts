import {
  Controller,
  Get,
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
} from '@nestjs/swagger'
import { CustomerPaymentService } from './customer-payment.service'
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto'
import { CustomerPaymentFilterDto } from './dto/customer-payment-filter.dto'
import { PayToAccountDto } from './dto/pay-to-account.dto'
import { VoidPaymentDto } from './dto/void-payment.dto'
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '../../generated/prisma/enums'

@ApiTags('Customer Payments')
@ApiBearerAuth('access-token')
@Controller('customer-payments')
export class CustomerPaymentController {
  constructor(private readonly customerPaymentService: CustomerPaymentService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un pago de un cliente (a cuenta o a una venta puntual)' })
  @ApiBody({ type: CreateCustomerPaymentDto })
  @ApiResponse({ status: 201, description: 'Pago registrado correctamente' })
  @ApiResponse({ status: 400, description: 'Monto inválido o supera la deuda/saldo pendiente' })
  @ApiResponse({ status: 404, description: 'Cliente o venta no encontrada' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerPaymentDto,
  ) {
    return this.customerPaymentService.create(user.tenantId, dto)
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar pagos de clientes con filtros y paginación' })
  @ApiResponse({ status: 200, description: 'Lista de pagos' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: CustomerPaymentFilterDto,
  ) {
    return this.customerPaymentService.findAll(tenantId, query)
  }

  @Get('by-customer/:customerId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Estado de cuenta de un cliente: deuda, ventas pendientes e historial de pagos' })
  @ApiParam({ name: 'customerId', description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Estado de cuenta del cliente' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  findByCustomer(
    @Param('customerId') customerId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.customerPaymentService.findByCustomer(customerId, tenantId)
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener pago por ID' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiResponse({ status: 200, description: 'Pago encontrado' })
  @ApiResponse({ status: 404, description: 'Pago no encontrado' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.customerPaymentService.findOne(id, tenantId)
  }

  @Post('pay-to-account')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un pago a cuenta, distribuido automáticamente entre las ventas pendientes más antiguas (FIFO)' })
  @ApiResponse({ status: 201, description: 'Pago aplicado y distribuido correctamente' })
  payToAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PayToAccountDto,
  ) {
    return this.customerPaymentService.payToAccount(user.tenantId, dto)
  }

  @Post(':id/void')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anular un pago (revierte deuda del cliente y saldo de la venta asociada)' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiBody({ type: VoidPaymentDto })
  @ApiResponse({ status: 200, description: 'Pago anulado correctamente' })
  @ApiResponse({ status: 400, description: 'El pago ya estaba anulado' })
  @ApiResponse({ status: 404, description: 'Pago no encontrado' })
  voidPayment(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: VoidPaymentDto,
  ) {
    return this.customerPaymentService.voidPayment(id, tenantId, dto)
  }
}
