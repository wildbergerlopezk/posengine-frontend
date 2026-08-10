import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger'
import { InternalReceiptService } from './internal-receipt.service'
import { InternalReceiptPdfService } from './internal-receipt-pdf.service'
import { CreateInternalReceiptDto } from './dto/create-internal-receipt.dto'
import { InternalReceiptFilterDto } from './dto/internal-receipt-filter.dto'
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '../../generated/prisma/enums'

@ApiTags('Internal Receipts')
@ApiBearerAuth('access-token')
@Controller('internal-receipts')
export class InternalReceiptController {
  constructor(
    private readonly internalReceiptService: InternalReceiptService,
    private readonly internalReceiptPdfService: InternalReceiptPdfService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Emitir un comprobante de control interno para una venta' })
  @ApiBody({ type: CreateInternalReceiptDto })
  @ApiResponse({ status: 201, description: 'Comprobante emitido correctamente' })
  @ApiResponse({ status: 400, description: 'Venta anulada' })
  @ApiResponse({ status: 404, description: 'Venta, empresa o cliente no encontrado' })
  @ApiResponse({ status: 409, description: 'La venta ya tiene un comprobante emitido' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInternalReceiptDto,
  ) {
    return this.internalReceiptService.create(user.tenantId, dto)
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar comprobantes internos con filtros y paginación' })
  @ApiResponse({ status: 200, description: 'Lista de comprobantes' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: InternalReceiptFilterDto,
  ) {
    return this.internalReceiptService.findAll(tenantId, query)
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener un comprobante interno por ID (incluye el snapshot para el PDF)' })
  @ApiParam({ name: 'id', description: 'Internal Receipt ID' })
  @ApiResponse({ status: 200, description: 'Comprobante encontrado' })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.internalReceiptService.findOne(id, tenantId)
  }

  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Descargar el PDF del comprobante interno' })
  @ApiParam({ name: 'id', description: 'Internal Receipt ID' })
  @ApiResponse({ status: 200, description: 'Archivo PDF' })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Res() res: Response,
  ) {
    const receipt = await this.internalReceiptService.findOne(id, tenantId)
    const pdfBuffer = await this.internalReceiptPdfService.generate(receipt as any)

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="comprobante-interno-${receipt.docNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    })
    res.send(pdfBuffer)
  }

  @Patch(':id/void')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Anular un comprobante interno (no anula la venta)' })
  @ApiParam({ name: 'id', description: 'Internal Receipt ID' })
  @ApiBody({ schema: { properties: { reason: { type: 'string' } } }, required: false })
  @ApiResponse({ status: 200, description: 'Comprobante anulado' })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  @ApiResponse({ status: 409, description: 'El comprobante ya está anulado' })
  void(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body('reason') reason?: string,
  ) {
    return this.internalReceiptService.void(id, tenantId, reason)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar completamente un comprobante interno' })
  @ApiParam({ name: 'id', description: 'Internal Receipt ID' })
  @ApiResponse({ status: 204, description: 'Comprobante eliminado' })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.internalReceiptService.remove(id, tenantId)
  }
}

