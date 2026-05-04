import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CashSessionStatus } from '../../generated/prisma/enums'

@Injectable()
export class CashSessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const tenantId = request.user?.tenantId

    if (!tenantId) {
      throw new BadRequestException('El tenant no está definido en la sesión')
    }

    const session = await this.prisma.cashSession.findFirst({
      where: {
        tenantId,
        status: CashSessionStatus.OPEN,
      },
    })

    if (!session) {
      throw new BadRequestException('Debes abrir caja antes de operar')
    }

    request.cashSession = session
    return true
  }
}
