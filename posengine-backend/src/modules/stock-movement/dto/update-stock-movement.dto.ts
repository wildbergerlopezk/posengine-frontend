import { PartialType } from '@nestjs/swagger';
import { CreateManualStockMovementDto } from './create-stock-movement.dto';
export class UpdateStockMovementDto extends PartialType(CreateManualStockMovementDto) {}
