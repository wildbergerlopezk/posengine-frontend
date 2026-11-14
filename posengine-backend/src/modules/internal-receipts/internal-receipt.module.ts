import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { CompanyModule } from '../company/company.module'
import { CustomerModule } from '../customer/customer.module'
import { SaleModule } from '../sale/sale.module'
import { InternalReceiptService } from './internal-receipt.service'
import { InternalReceiptPdfService } from './internal-receipt-pdf.service'
import { InternalReceiptController } from './internal-receipt.controller'
import { UploadModule } from '../upload/upload.module'

@Module({
  imports: [PrismaModule, CompanyModule, CustomerModule, SaleModule, UploadModule],
  controllers: [InternalReceiptController],
  providers: [InternalReceiptService, InternalReceiptPdfService],
  exports: [InternalReceiptService],
})
export class InternalReceiptModule {}
