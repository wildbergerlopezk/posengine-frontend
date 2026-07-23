import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async getByTenant(tenantId: string) {
    // SAAS BILLING HOOK:
    // When recurring payments or plan changes are added, this service is the
    // right place to check payment status, renewals, and subscription expiration.
    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Suscripción no encontrada para este inquilino');
    }

    return subscription;
  }
}
