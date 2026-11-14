// src/customers/dto/customer-filter.dto.ts
import { IsOptional, IsString, IsBoolean, IsInt, Max, Min } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
export class CustomerFilterDto {
  @ApiPropertyOptional({ description: 'Busca en nombre, apellido, documento, teléfono, email' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string

  @ApiPropertyOptional({ description: 'Filtrar por clientes con crédito habilitado' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  @IsBoolean()
  creditEnabled?: boolean

  @ApiPropertyOptional({ description: 'Limita el resultado a clientes con deuda pendiente' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  hasDebt?: boolean

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number = 1

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}
