import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new ForbiddenException('No se ha detectado el inquilino correspondiente para el usuario');
    }

    try {
      // SAAS BILLING HOOK:
      // This guard should later evaluate the tenant's payment state, grace period,
      // and subscription validity before allowing access to the app.
      const subscription = await this.subscriptionService.getByTenant(user.tenantId);
      if (subscription.status !== 'ACTIVE') {
        throw new ForbiddenException('Su suscripción no está activa. Por favor, regularice su pago.');
      }
      return true;
    } catch (error) {
      throw new ForbiddenException('Su suscripción no está activa o no fue encontrada');
    }
  }
}
