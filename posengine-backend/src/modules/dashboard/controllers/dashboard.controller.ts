import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { DashboardService } from '../services/dashboard.service'
import { CurrentUser } from '../../../common/decorators/current-user.decorator'
import { Roles } from '../../../common/decorators/roles.decorator'
import { UserRole } from '../../../generated/prisma/enums'

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener métricas y estadísticas del dashboard' })
  @ApiResponse({ status: 200, description: 'Estadísticas del dashboard' })
  getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.dashboardService.getStats(tenantId)
  }
}
