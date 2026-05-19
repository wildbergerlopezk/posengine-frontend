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
import { CashSessionService } from './cash-session.service'
import { OpenCashSessionDto } from './dto/open-cash-session.dto'
import { CloseCashSessionDto } from './dto/close-cash-session.dto'
import { CashSessionFilterDto } from './dto/cash-session-filter.dto'
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '../../generated/prisma/enums'

@ApiTags('Cash Sessions')
@ApiBearerAuth('access-token')
@Controller('cash-sessions')
export class CashSessionController {
  constructor(private readonly cashSessionService: CashSessionService) {}

  @Post('open')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Abrir una nueva sesión de caja' })
  @ApiBody({ type: OpenCashSessionDto })
  @ApiResponse({ status: 201, description: 'Sesión de caja abierta correctamente' })
  @ApiResponse({ status: 409, description: 'Ya existe una sesión abierta' })
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OpenCashSessionDto,
  ) {
    return this.cashSessionService.open(user.tenantId, user.id, dto)
  }

  @Get('current')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener la sesión de caja actualmente abierta' })
  @ApiResponse({ status: 200, description: 'Sesión actual (o null si no hay)' })
  getCurrent(@CurrentUser('tenantId') tenantId: string) {
    return this.cashSessionService.getCurrent(tenantId)
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar una sesión de caja' })
  @ApiParam({ name: 'id', description: 'Cash Session ID' })
  @ApiBody({ type: CloseCashSessionDto })
  @ApiResponse({ status: 200, description: 'Sesión cerrada correctamente' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  close(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cashSessionService.close(tenantId, id, dto)
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar sesiones de caja con paginación y filtros' })
  @ApiResponse({ status: 200, description: 'Lista de sesiones de caja' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() filters: CashSessionFilterDto,
  ) {
    return this.cashSessionService.findAll(tenantId, filters)
  }

  @Get('history')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener historial mensual de sesiones de caja' })
  @ApiResponse({ status: 200, description: 'Historial mensual de sesiones' })
  getHistory(
    @CurrentUser('tenantId') tenantId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.cashSessionService.getHistory(
      tenantId,
      Number(year),
      Number(month),
    )
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener sesión de caja por ID' })
  @ApiParam({ name: 'id', description: 'Cash Session ID' })
  @ApiResponse({ status: 200, description: 'Sesión encontrada' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.cashSessionService.findOne(tenantId, id)
  }
}
