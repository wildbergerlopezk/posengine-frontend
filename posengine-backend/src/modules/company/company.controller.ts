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
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Companies')
@ApiBearerAuth('access-token')
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva empresa' })
  @ApiBody({ type: CreateCompanyDto })
  @ApiResponse({ status: 201, description: 'Empresa creada correctamente' })
  @ApiResponse({ status: 409, description: 'Slug o RUC ya existe' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
  ) {
    return this.companyService.create(user.tenantId, dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar empresas del tenant con paginación' })
  @ApiResponse({ status: 200, description: 'Lista de empresas' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.companyService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener empresa por ID' })
  @ApiParam({ name: 'id', description: 'Company ID' })
  @ApiResponse({ status: 200, description: 'Empresa encontrada' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.companyService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Actualizar empresa por ID' })
  @ApiParam({ name: 'id', description: 'Company ID' })
  @ApiBody({ type: UpdateCompanyDto })
  @ApiResponse({ status: 200, description: 'Empresa actualizada correctamente' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  @ApiResponse({ status: 409, description: 'Slug o RUC ya en uso' })
  update(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companyService.update(id, tenantId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar/Desasociar empresa por ID' })
  @ApiParam({ name: 'id', description: 'Company ID' })
  @ApiResponse({ status: 200, description: 'Empresa eliminada/desasociada correctamente' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  remove(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.companyService.remove(id, tenantId);
  }
}
