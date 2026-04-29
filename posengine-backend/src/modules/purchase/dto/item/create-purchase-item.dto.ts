import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePurchaseItemDto {
  @ApiProperty({ example: 'uuid-del-producto' })
  @IsString()
  @IsNotEmpty({ message: 'productId es requerido' })
  productId!: string;

  @ApiProperty({ example: 10 })
  @IsNumber({}, { message: 'quantity debe ser un número' })
  @IsPositive({ message: 'quantity debe ser mayor a 0' })
  quantity!: number;

  @ApiProperty({ example: 15000 })
  @IsNumber({}, { message: 'unitCost debe ser un número' })
  @IsPositive({ message: 'unitCost debe ser mayor a 0' })
  unitCost!: number;

  @ApiProperty({ example: 150000, description: 'quantity * unitCost' })
  @IsNumber({}, { message: 'total debe ser un número' })
  @IsPositive({ message: 'total debe ser mayor a 0' })
  total!: number;
}

export class BulkCreatePurchaseItemsDto {
  @ApiProperty({ type: [CreatePurchaseItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe haber al menos un item' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}