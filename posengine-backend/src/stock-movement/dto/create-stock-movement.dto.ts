import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { StockMovementType, StockMovementSourceType } from '../../../src/generated/prisma/enums';

export class CreateManualStockMovementDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    enum: StockMovementType,
    description: 'Movement type. Only MANUAL is accepted here.',
    example: StockMovementType.MANUAL,
  })
  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @ApiProperty({ description: 'Quantity to add (positive) or subtract (negative)', example: 10 })
  @IsNumber()
  quantity!: number;

  @ApiPropertyOptional({ description: 'Reason or note for this movement' })
  @IsOptional()
  @IsString()
  notes?: string;
}