import { Controller } from '@nestjs/common';
import { PurchaseService } from '../services/purchase.service';

@Controller('purchase')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}
}
