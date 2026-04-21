import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductUnit } from '../../../generated/prisma/enums';

export class CreateProductDto {
  @ApiProperty({ example: 'Cadena 428H x 120 eslabones' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @MinLength(2)
  @MaxLength(150)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiPropertyOptional({ example: 'Cadena de transmisión para motos 125cc' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({ example: 'e0000101' })
  @IsString()
  @IsNotEmpty({ message: 'La categoría es requerida' })
  categoryId!: string;

  @ApiPropertyOptional({ example: 'e0000201' })
  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @ApiPropertyOptional({ example: 'REP-00001', description: 'Si no se provee, se genera automáticamente' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim().toUpperCase())
  sku?: string;

  @ApiPropertyOptional({ example: '7891234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => value?.trim())
  barcode?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/products/cadena.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ example: 85000 })
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  @Type(() => Number)
  price!: number;

  @ApiPropertyOptional({ example: 60000 })
  @IsOptional()
  @IsNumber({}, { message: 'El costo debe ser un número' })
  @Min(0, { message: 'El costo no puede ser negativo' })
  @Type(() => Number)
  cost?: number;

  @ApiPropertyOptional({ example: 10, description: 'Porcentaje de IVA, ej: 10' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxRate?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stock?: number;

  @ApiPropertyOptional({ example: 5, description: 'Stock mínimo para alerta de reposición' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockMinimum?: number;

  @ApiPropertyOptional({ enum: ProductUnit, default: ProductUnit.UNIT })
  @IsOptional()
  @IsEnum(ProductUnit)
  unit?: ProductUnit;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}