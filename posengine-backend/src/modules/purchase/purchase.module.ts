import { Module } from '@nestjs/common';
import { PurchaseController } from './controllers/purchase.controller';
import { PurchaseItemController } from './controllers/purchase-item.controller'; 
import { PurchaseReturnController } from './controllers/purchase-return.controller';
import { PurchaseService } from './services/purchase.service';
import { PurchaseItemService } from './services/purchase-item.service';
import { PurchaseCreditService } from './services/purchase-credit.service';
import { PurchaseInstallmentService } from './services/purchase-installment.service';
import { PurchaseReturnService } from './services/purchase-return.service';
import { StockMovementModule } from '../../stock-movement/stock-movement.module';

@Module({
  imports: [StockMovementModule],
  controllers: [
    PurchaseController,
    PurchaseItemController, 
    PurchaseReturnController,
  ],
  providers: [
    PurchaseService,
    PurchaseItemService,
    PurchaseCreditService,
    PurchaseInstallmentService,
    PurchaseReturnService,
  ],
  exports: [PurchaseService],
})
export class PurchaseModule {}