import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsNotEmpty, IsNumber,
  IsIn, IsOptional, IsPositive, IsString, IsUUID,
  MaxLength, Min, ValidateNested,
} from 'class-validator';

export class CreatePurchaseReturnItemDto {
  @ApiProperty({ description: 'ID del ítem original de la compra' })
  @IsUUID()
  @IsNotEmpty()
  purchaseItemId!: string;

  @ApiProperty({ description: 'Cantidad a devolver' })
  @IsNumber()
  @Min(0.01)
  quantity!: number;
}

export class CreatePurchaseReturnDto {
  @ApiProperty({ description: 'ID de la compra a devolver' })
  @IsUUID()
  @IsNotEmpty()
  purchaseId!: string;

  @ApiProperty({ example: '2026-04-24T00:00:00.000Z' })
  @IsDateString()
  returnDate!: string;

  @ApiPropertyOptional({ example: 'Producto defectuoso' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ example: 'NC-001-001-0000001' })
  @IsOptional()
  @IsString()
  creditNoteNumber?: string;

  @ApiProperty({ type: [CreatePurchaseReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items!: CreatePurchaseReturnItemDto[];
}

export class ConfirmPurchaseReturnDto {
  @ApiPropertyOptional({
    enum: ['REFUND_PENDING', 'REFUND_CASH', 'REFUND_TRANSFER', 'SUPPLIER_CREDIT'],
    description: 'Destino explícito del excedente después de compensar deuda pendiente.',
  })
  @IsOptional()
  @IsIn(['REFUND_PENDING', 'REFUND_CASH', 'REFUND_TRANSFER', 'SUPPLIER_CREDIT'])
  settlementDisposition?: 'REFUND_PENDING' | 'REFUND_CASH' | 'REFUND_TRANSFER' | 'SUPPLIER_CREDIT'
}

export class SettlePurchaseReturnRefundDto {
  @ApiProperty({ description: 'Importe recibido en este abono' })
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

export class ApplyPurchaseReturnCreditDto {
  @ApiProperty({ description: 'Compra a crédito del mismo proveedor' })
  @IsUUID()
  purchaseId!: string

  @ApiProperty({ description: 'Monto del crédito a aplicar' })
  @IsNumber()
  @Min(0.01)
  amount!: number
}
