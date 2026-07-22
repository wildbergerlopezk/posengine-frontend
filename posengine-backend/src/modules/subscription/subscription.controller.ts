import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Subscription')
@ApiBearerAuth('access-token')
@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener la suscripción activa del tenant actual' })
  @ApiResponse({ status: 200, description: 'Devuelve los detalles de la suscripción y el plan' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Suscripción no encontrada' })
  async getMySubscription(@CurrentUser() user: AuthenticatedUser) {
    if (!user.tenantId) {
      throw new Error('El usuario no pertenece a ningún inquilino');
    }
    return this.subscriptionService.getByTenant(user.tenantId);
  }
}
