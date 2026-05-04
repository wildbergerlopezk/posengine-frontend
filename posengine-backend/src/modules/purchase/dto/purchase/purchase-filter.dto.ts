import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator'; 
import { ApiPropertyOptional } from '@nestjs/swagger'; 
import { Type } from 'class-transformer'; 
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto'; 
import { PurchaseStatus, PurchasePaymentType } from '../../../../generated/prisma/enums'; 
 
export class PurchaseFilterDto extends PaginationQueryDto { 
  @ApiPropertyOptional({ description: 'Buscar por nro. de factura, nombre o RUC del proveedor' }) 
  @IsOptional() 
  @IsString() 
  search?: string; 

  @ApiPropertyOptional({ description: 'Filtrar por ID de proveedor' })
  @IsOptional()
  @IsString()
  supplierId?: string;
 
  @ApiPropertyOptional({ enum: PurchaseStatus }) 
  @IsOptional() 
  @IsEnum(PurchaseStatus) 
  status?: PurchaseStatus; 
 
  @ApiPropertyOptional({ enum: PurchasePaymentType }) 
  @IsOptional() 
  @IsEnum(PurchasePaymentType) 
  paymentType?: PurchasePaymentType; 
 
  @ApiPropertyOptional({ description: 'Fecha exacta o desde (ISO 8601)', example: '2025-01-01' }) 
  @IsOptional() 
  @IsDateString() 
  dateFrom?: string; 
 
  @ApiPropertyOptional({ description: 'Fecha hasta (ISO 8601)', example: '2025-12-31' }) 
  @IsOptional() 
  @IsDateString() 
  dateTo?: string; 
} 
