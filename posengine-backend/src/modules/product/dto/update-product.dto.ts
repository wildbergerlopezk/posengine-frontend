import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({ description: 'Motivo del ajuste de stock (solo si stock cambia)' })
  @IsOptional()
  @IsString()
  stockNotes?: string;
}