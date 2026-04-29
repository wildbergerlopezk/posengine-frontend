import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { StockMovementModule } from '../../stock-movement/stock-movement.module';

@Module({
  imports: [StockMovementModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}