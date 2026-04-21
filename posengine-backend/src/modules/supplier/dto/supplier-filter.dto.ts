import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class SupplierFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ 
    example: 'Comercial', 
    description: 'Busca por nombre, RUC, teléfono o dirección' 
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;
}
