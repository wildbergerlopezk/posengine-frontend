// src/sales/sale.module.ts
import { Module } from '@nestjs/common'
import { SaleService } from './services/sale.service'
import { SaleValidationService } from './services/sale-validation.service'
import { SaleCreditService } from './services/sale-credit.service'
import { SaleController } from './controllers/sale.controller'
import { StockMovementModule } from '../stock-movement/stock-movement.module'
import { ProductModule } from '../product/product.module'

@Module({
  imports: [
    StockMovementModule,
    ProductModule, // para inyectar ProductService.validateQuantity
  ],
  controllers: [SaleController],
  providers: [
    SaleService,
    SaleValidationService,
    SaleCreditService,
  ],
  exports: [
    SaleService,
    SaleValidationService,
    SaleCreditService,
  ],
})
export class SaleModule {}