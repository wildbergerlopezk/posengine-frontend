import { Module } from '@nestjs/common'
import { CashSessionModule } from '../cash-session/cash-session.module'
import { DashboardController } from './controllers/dashboard.controller'
import { DashboardService } from './services/dashboard.service'

@Module({
  imports: [CashSessionModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
