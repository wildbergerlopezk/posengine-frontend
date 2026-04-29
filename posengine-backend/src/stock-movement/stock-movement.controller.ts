import {
  Controller,
  Get,
  Post,
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
import { StockMovementService } from './stock-movement.service';
import { CreateManualStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementFilterDto } from './dto/stock-movement-filter.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/enums';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Stock Movements')
@ApiBearerAuth('access-token')
@Controller('stock-movements')
export class StockMovementController {
  constructor(private readonly stockMovementService: StockMovementService) {}

  @Post('manual')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a manual stock adjustment',
    description:
      'Adds or subtracts stock from a product manually. Use positive quantity to add, negative to subtract.',
  })
  @ApiBody({ type: CreateManualStockMovementDto })
  @ApiResponse({ status: 201, description: 'Movement registered and stock updated' })
  @ApiResponse({ status: 400, description: 'Invalid type or resulting stock would be negative' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  registerManual(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateManualStockMovementDto,
  ) {
    return this.stockMovementService.registerManual(tenantId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get all stock movements for tenant with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of stock movements' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: StockMovementFilterDto,
  ) {
    return this.stockMovementService.findAll(tenantId, query);
  }

  @Get('product/:productId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Get stock movements for a specific product' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Paginated list of movements for the product' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findByProduct(
    @Param('productId') productId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.stockMovementService.findByProduct(productId, tenantId, query);
  }
}