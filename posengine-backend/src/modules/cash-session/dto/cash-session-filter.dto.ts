import { IsEnum, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { CashSessionStatus } from '../../../generated/prisma/enums'

export class CashSessionFilterDto {
  @ApiPropertyOptional({ enum: CashSessionStatus })
  @IsOptional()
  @IsEnum(CashSessionStatus, { message: 'estado inválido' })
  status?: CashSessionStatus

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'dateFrom debe ser una fecha ISO válida (YYYY-MM-DD)' })
  dateFrom?: string

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsISO8601({}, { message: 'dateTo debe ser una fecha ISO válida (YYYY-MM-DD)' })
  dateTo?: string

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