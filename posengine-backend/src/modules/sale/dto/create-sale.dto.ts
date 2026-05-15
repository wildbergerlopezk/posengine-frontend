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
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { PriceType } from '../../../generated/prisma/enums'

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

}