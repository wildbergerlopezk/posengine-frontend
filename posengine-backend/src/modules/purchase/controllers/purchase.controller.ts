import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { PurchaseService } from '../services/purchase.service';
import { CreatePurchaseDto } from '../dto/purchase/create-purchase.dto';
import { PurchaseFilterDto } from '../dto/purchase/purchase-filter.dto';
import { CurrentUser, type AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../generated/prisma/enums';
import { CashSessionGuard } from '../../../common/guards/cash-session.guard';

@ApiTags('Purchases')
@ApiBearerAuth('access-token')
@Controller('purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get('generate-invoice-number')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Generate a unique invoice number (format: 001-001-XXXXXXX)',
    description: 'Called by the frontend with Alt+Q to auto-fill the invoice number field.',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice number generated',
    schema: { example: { invoiceNumber: '001-001-0058689' } },
  })
  generateInvoiceNumber(@CurrentUser('tenantId') tenantId: string) {
    return this.purchaseService.generateInvoiceNumber(tenantId);
  }

  @Post()
  @UseGuards(CashSessionGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new purchase' })
  @ApiBody({ type: CreatePurchaseDto })
  @ApiResponse({ status: 201, description: 'Purchase created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request / invalid invoice format' })
  @ApiResponse({ status: 409, description: 'Invoice number already exists' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Request() req: any,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.purchaseService.create(user.tenantId, req.cashSession.id, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get all purchases for tenant with pagination and filters' })
  @ApiResponse({ status: 200, description: 'List of purchases' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PurchaseFilterDto,
  ) {
    return this.purchaseService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get purchase by ID' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiResponse({ status: 200, description: 'Purchase found' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseService.findOne(id, tenantId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Cancel a purchase' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiResponse({ status: 200, description: 'Purchase cancelled successfully' })
  @ApiResponse({ status: 409, description: 'Purchase is already cancelled' })
  cancel(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseService.cancel(id, tenantId);
  }
}