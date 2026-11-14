import { Transform, Type } from 'class-transformer'
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ProductSearchDto {
  @ApiPropertyOptional({ description: 'Busca por nombre, SKU, código de barras y descripción' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string

  @ApiPropertyOptional({ description: 'Filtra por estado de actividad cuando el flujo lo requiere' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  @IsBoolean()
  isActive?: boolean

  @ApiPropertyOptional({ minimum: 1, maximum: 30, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit = 30
}
