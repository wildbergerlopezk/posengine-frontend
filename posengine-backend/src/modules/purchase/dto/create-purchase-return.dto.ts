import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsNotEmpty, IsNumber,
  IsOptional, IsPositive, IsString, IsUUID,
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
