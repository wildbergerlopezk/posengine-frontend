import { Module } from '@nestjs/common'
import { CustomerPaymentService } from './customer-payment.service'
import { CustomerPaymentController } from './customer-payment.controller'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  imports: [PrismaModule],
  controllers: [CustomerPaymentController],
  providers: [CustomerPaymentService],
  exports: [CustomerPaymentService],
})
export class CustomerPaymentModule {}
