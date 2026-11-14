import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { Roles } from './common/decorators/roles.decorator';
import { UserRole } from './generated/prisma/enums';
import { CommercialOperationPolicy } from './common/commercial-operation-policy';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/health')
  @Public()
  health() {
    return { status: 'ok' };
  }

  @Get('/commercial-operations/capabilities')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  commercialOperationCapabilities() {
    return CommercialOperationPolicy.getCapabilities();
  }
}
