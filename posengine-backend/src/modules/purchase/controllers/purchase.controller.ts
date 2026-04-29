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
import { UpdatePurchaseDto } from '../dto/purchase/update-purchase.dto';
import { PurchaseFilterDto } from '../dto/purchase/purchase-filter.dto';
import { CurrentUser, type AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../generated/prisma/enums';

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
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new purchase' })
  @ApiBody({ type: CreatePurchaseDto })
  @ApiResponse({ status: 201, description: 'Purchase created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request / invalid invoice format' })
  @ApiResponse({ status: 409, description: 'Invoice number already exists' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.purchaseService.create(user.tenantId, dto);
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

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Update purchase by ID' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiBody({ type: UpdatePurchaseDto })
  @ApiResponse({ status: 200, description: 'Purchase updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot modify a cancelled purchase' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    return this.purchaseService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete purchase by ID (only PENDING purchases)' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiResponse({ status: 200, description: 'Purchase deleted successfully' })
  @ApiResponse({ status: 400, description: 'Only PENDING purchases can be deleted' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseService.remove(id, tenantId);
  }

  @Patch(':id/receive')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Mark purchase as received' })
  @ApiParam({ name: 'id', description: 'Purchase ID' })
  @ApiResponse({ status: 200, description: 'Purchase marked as received' })
  @ApiResponse({ status: 400, description: 'Only PENDING purchases can be received' })
  markAsReceived(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseService.markAsReceived(id, tenantId);
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