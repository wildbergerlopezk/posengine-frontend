// src/sales/dto/create-sale.dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  MaxLength,
  Min,
  IsEnum,
  ValidateIf,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { PriceType, PaymentMethod } from '../../../generated/prisma/enums'

export class CreateSaleItemDto {
  @ApiProperty({ example: 'uuid-del-producto' })
  @IsString()
  @IsNotEmpty({ message: 'productId es requerido' })
  productId!: string

  @ApiProperty({
    example: 3,
    description: 'Cantidad vendida. Para productos por UNIT debe ser entero.',
  })
  @IsNumber({}, { message: 'quantity debe ser un número' })
  @IsPositive({ message: 'quantity debe ser mayor a 0' })
  quantity!: number

  @ApiProperty({
    example: 5000,
    description: 'Precio unitario de venta. No puede ser menor al precio base del producto.',
  })
  @IsNumber({}, { message: 'unitPrice debe ser un número' })
  @Min(0, { message: 'unitPrice no puede ser negativo' })
  unitPrice!: number

  @ApiPropertyOptional({ enum: PriceType, default: PriceType.PUBLIC })
  @IsEnum(PriceType)
  @IsOptional()
  priceType?: PriceType
}

export class CreateSaleDto {
  @ApiProperty({ type: [CreateSaleItemDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'La venta debe tener al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[]

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod

  @ApiPropertyOptional({ description: 'Requerido si paymentMethod es CREDIT' })
  @ValidateIf((o) => o.paymentMethod === PaymentMethod.CREDIT)
  @IsString()
  @IsNotEmpty({ message: 'customerId es requerido para ventas a crédito' })
  customerId?: string

  @ApiPropertyOptional({
    example: 50000,
    description: 'Monto abonado al momento de la venta (seña). Si no se envía, se asume 0 en ventas a crédito.',
  })
  @IsNumber({}, { message: 'amountPaid debe ser un número' })
  @Min(0, { message: 'amountPaid no puede ser negativo' })
  @IsOptional()
  amountPaid?: number
}