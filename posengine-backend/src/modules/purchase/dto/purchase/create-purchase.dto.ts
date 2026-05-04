import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsPositive,
  MaxLength,
  Matches,
  ValidateNested,
  ArrayNotEmpty,
  IsArray,
} from 'class-validator'

import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PurchasePaymentType } from '../../../../generated/prisma/enums'

class CreatePurchaseItemDto {
  @ApiProperty({ example: 'uuid-producto' })
  @IsString()
  @IsNotEmpty()
  productId!: string

  @ApiProperty({ example: 5 })
  @IsNumber()
  @IsPositive()
  quantity!: number

  @ApiProperty({ example: 15000 })
  @IsNumber()
  @IsPositive()
  unitCost!: number
}

export class CreatePurchaseDto {
  @ApiProperty({ example: 'uuid-del-proveedor' })
  @IsString()
  @IsNotEmpty({ message: 'supplierId es requerido' })
  supplierId!: string

  @ApiProperty({
    example: '001-001-0058689',
    description: 'Número de factura en formato 001-001-XXXXXXX',
  })
  @IsString()
  @IsNotEmpty({ message: 'invoiceNumber es requerido' })
  @Matches(/^\d{3}-\d{3}-\d{7}$/, {
    message: 'El número de factura debe tener el formato 001-001-0000001',
  })
  invoiceNumber!: string

  @ApiProperty({ example: '2026-04-11T00:00:00.000Z' })
  @IsDateString({}, { message: 'purchaseDate debe ser una fecha válida' })
  @IsNotEmpty({ message: 'purchaseDate es requerida' })
  purchaseDate!: string

  @ApiProperty({ enum: PurchasePaymentType, example: PurchasePaymentType.CASH })
  @IsEnum(PurchasePaymentType, { message: 'paymentType debe ser CASH o CREDIT' })
  @IsNotEmpty({ message: 'paymentType es requerido' })
  paymentType!: PurchasePaymentType

  @ApiProperty({ example: 298899 })
  @IsNumber({}, { message: 'total debe ser un número' })
  @IsPositive({ message: 'total debe ser mayor a 0' })
  total!: number

  @ApiPropertyOptional({ example: 'Compra de repuestos para motos' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  notes?: string

  @ApiProperty({ type: [CreatePurchaseItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[]
}