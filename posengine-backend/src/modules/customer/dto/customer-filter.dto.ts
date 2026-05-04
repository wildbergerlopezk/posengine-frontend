// src/customers/dto/customer-filter.dto.ts
import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator'
import { Transform, Type } from 'class-transformer'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentType } from '../../../generated/prisma/enums'

export class CustomerFilterDto {
  @ApiPropertyOptional({ description: 'Busca en nombre, apellido, documento, teléfono, email' })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType

  @ApiPropertyOptional({ description: 'Filtrar por clientes con crédito habilitado' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : undefined)
  @IsBoolean()
  creditEnabled?: boolean

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20
}