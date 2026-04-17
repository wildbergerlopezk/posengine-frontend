import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    HttpCode,
    HttpStatus,
    Query,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiBody,
    ApiParam,
} from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../generated/prisma/enums';

@ApiTags('Products')
@ApiBearerAuth('access-token')
@Controller('products')
export class ProductController {
    constructor(private readonly productService: ProductService) { }

    @Post()
    @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new product' })
    @ApiBody({ type: CreateProductDto })
    @ApiResponse({ status: 201, description: 'Product created successfully' })
    @ApiResponse({ status: 400, description: 'Bad request - hierarchy validation failed' })
    create(
        @CurrentUser('tenantId') tenantId: string,
        @Body() dto: CreateProductDto,
    ) {
        return this.productService.create(tenantId, dto);
    }

    @Get()
    @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
    @ApiOperation({ summary: 'Get all products for tenant with pagination' })
    @ApiResponse({ status: 200, description: 'List of products' })
    findAll(
        @CurrentUser('tenantId') tenantId: string,
        @Query() query: PaginationQueryDto
    ) {
        return this.productService.findAll(tenantId, query);
    }

    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
    @ApiOperation({ summary: 'Get product by ID' })
    @ApiParam({ name: 'id', description: 'Product ID' })
    findOne(
        @Param('id') id: string,
        @CurrentUser('tenantId') tenantId: string,
    ) {
        return this.productService.findOne(id, tenantId);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
    @ApiOperation({ summary: 'Update product by ID' })
    @ApiParam({ name: 'id', description: 'Product ID' })
    update(
        @Param('id') id: string,
        @CurrentUser('tenantId') tenantId: string,
        @Body() dto: UpdateProductDto,
    ) {
        return this.productService.update(id, tenantId, dto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete product by ID' })
    @ApiParam({ name: 'id', description: 'Product ID' })
    remove(
        @Param('id') id: string,
        @CurrentUser('tenantId') tenantId: string,
    ) {
        return this.productService.remove(id, tenantId);
    }
}
