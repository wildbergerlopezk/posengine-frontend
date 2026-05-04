import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { StockMovementType } from '../../../generated/prisma/enums';

export class StockMovementFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Buscar por nombre de producto, SKU o notas' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: StockMovementType })
  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;

  @ApiPropertyOptional({ description: 'Fecha desde (ISO 8601)', example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (ISO 8601)', example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
