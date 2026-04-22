import { Controller } from '@nestjs/common';
import { PurchaseReturnService } from '../services/purchase-return.service';

@Controller('purchase-return')
export class PurchaseReturnController {
  constructor(private readonly purchaseReturnService: PurchaseReturnService) {}
}
