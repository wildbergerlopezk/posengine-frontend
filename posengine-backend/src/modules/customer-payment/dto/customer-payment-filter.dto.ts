import { IsOptional, IsString, IsInt, Min, IsDateString } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class CustomerPaymentFilterDto {
  @ApiPropertyOptional({ description: 'Filtrar pagos de un cliente puntual' })
  @IsOptional()
  @IsString()
  customerId?: string

  @ApiPropertyOptional({ description: 'Filtrar pagos aplicados a una venta puntual' })
  @IsOptional()
  @IsString()
  saleId?: string

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number
}
