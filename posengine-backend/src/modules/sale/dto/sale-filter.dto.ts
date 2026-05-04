// src/sales/dto/sale-filter.dto.ts
import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { SaleStatus } from '../../../generated/prisma/enums'

export class SaleFilterDto {
  @ApiPropertyOptional({ enum: SaleStatus })
  @IsOptional()
  @IsEnum(SaleStatus, { message: 'estado inválido' })
  status?: SaleStatus

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'dateFrom debe ser una fecha ISO válida (YYYY-MM-DD)' })
  dateFrom?: string

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsISO8601({}, { message: 'dateTo debe ser una fecha ISO válida (YYYY-MM-DD)' })
  dateTo?: string

  @ApiPropertyOptional({ example: 'uuid-cash-session' })
  @IsOptional()
  cashSessionId?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}