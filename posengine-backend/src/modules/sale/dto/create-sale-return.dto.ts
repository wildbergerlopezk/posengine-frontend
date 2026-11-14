import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID,
  MaxLength, Min, ValidateNested,
} from 'class-validator'

export class CreateSaleReturnItemDto {
  @ApiProperty({ description: 'ID del ítem original de la venta' })
  @IsUUID()
  saleItemId!: string

  @ApiProperty({ description: 'Cantidad a devolver' })
  @IsNumber()
  @Min(0.01)
  quantity!: number

  @ApiProperty({ enum: ['RESTOCKABLE', 'DAMAGED'] })
  @IsIn(['RESTOCKABLE', 'DAMAGED'])
  disposition!: 'RESTOCKABLE' | 'DAMAGED'
}

export class CreateSaleReturnDto {
  @ApiProperty()
  @IsUUID()
  saleId!: string

  @ApiProperty()
  @IsDateString()
  returnDate!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string

  @ApiProperty({ type: [CreateSaleReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleReturnItemDto)
  items!: CreateSaleReturnItemDto[]
}

export class ConfirmSaleReturnDto {
  @ApiPropertyOptional({ enum: ['REFUND_PENDING', 'REFUND_CASH', 'REFUND_TRANSFER'] })
  @IsOptional()
  @IsIn(['REFUND_PENDING', 'REFUND_CASH', 'REFUND_TRANSFER'])
  settlementDisposition?: 'REFUND_PENDING' | 'REFUND_CASH' | 'REFUND_TRANSFER'
}

export class SettleSaleReturnRefundDto {
  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiProperty({ enum: ['CASH', 'TRANSFER'] })
  @IsIn(['CASH', 'TRANSFER'])
  paymentMethod!: 'CASH' | 'TRANSFER'

  @ApiPropertyOptional({ example: '2026-11-13T15:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  effectiveAt?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string
}
