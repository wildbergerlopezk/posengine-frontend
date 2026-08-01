import { IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class InternalReceiptFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  saleId?: string

  @ApiPropertyOptional({ description: 'Filtra por comprobantes anulados o no' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  voided?: boolean

  @ApiPropertyOptional({ example: '2026-07-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ example: '2026-07-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number
}
