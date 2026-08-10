import { Module } from '@nestjs/common';
import { PurchaseController } from './controllers/purchase.controller';
import { PurchaseReturnController } from './controllers/purchase-return.controller';
import { PurchaseService } from './services/purchase.service';
import { PurchaseValidationService } from './services/purchase-validation.service';
import { PurchaseReturnService } from './services/purchase-return.service';
import { PurchaseDebtService } from './services/purchase-debt.service';
import { StockMovementModule } from '../stock-movement/stock-movement.module';
import { ProductModule } from '../product/product.module';
import { CashSessionGuard } from '../../common/guards/cash-session.guard';

@Module({
  imports: [StockMovementModule, ProductModule],
  controllers: [
    PurchaseController,
    PurchaseReturnController,
  ],
  providers: [
    PurchaseService,
    PurchaseValidationService,
    PurchaseReturnService,
    PurchaseDebtService,
    CashSessionGuard,
  ],
  exports: [
    PurchaseService,
    PurchaseValidationService,
    PurchaseDebtService,
  ],
})
export class PurchaseModule {}
