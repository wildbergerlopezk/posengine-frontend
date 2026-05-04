import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
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
import { PurchaseItemService } from '../services/purchase-item.service';
import { BulkCreatePurchaseItemsDto } from '../dto/item/create-purchase-item.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '../../../generated/prisma/enums';

@ApiTags('Purchase Items')
@ApiBearerAuth('access-token')
@Controller('purchases/:purchaseId/items')
export class PurchaseItemController {
  constructor(private readonly purchaseItemService: PurchaseItemService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bulk load items into a purchase',
    description:
      'Adds one or more products to a purchase. Only allowed if NOT RECEIVED.',
  })
  @ApiParam({ name: 'purchaseId', description: 'Purchase ID' })
  @ApiBody({ type: BulkCreatePurchaseItemsDto })
  @ApiResponse({ status: 201, description: 'Items loaded successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or purchase already RECEIVED' })
  @ApiResponse({ status: 404, description: 'Purchase or product not found' })
  @ApiResponse({ status: 409, description: 'Product already exists in this purchase' })
  bulkCreate(
    @Param('purchaseId') purchaseId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: BulkCreatePurchaseItemsDto,
  ) {
    return this.purchaseItemService.bulkCreate(purchaseId, tenantId, dto.items);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get all items for a purchase' })
  @ApiParam({ name: 'purchaseId', description: 'Purchase ID' })
  @ApiResponse({ status: 200, description: 'List of purchase items' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  findAll(
    @Param('purchaseId') purchaseId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseItemService.findAllByPurchase(purchaseId, tenantId);
  }

  @Delete(':itemId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an item from a purchase' })
  @ApiParam({ name: 'purchaseId', description: 'Purchase ID' })
  @ApiParam({ name: 'itemId', description: 'Purchase Item ID' })
  @ApiResponse({ status: 200, description: 'Item removed successfully' })
  @ApiResponse({ status: 400, description: 'Purchase is already RECEIVED' })
  @ApiResponse({ status: 404, description: 'Purchase or item not found' })
  remove(
    @Param('purchaseId') purchaseId: string,
    @Param('itemId') itemId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.purchaseItemService.remove(itemId, purchaseId, tenantId);
  }
}