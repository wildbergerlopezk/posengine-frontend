import { IsString, IsNotEmpty, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateInternalReceiptDto {
  @ApiProperty({ example: 'uuid-de-la-venta' })
  @IsString()
  @IsNotEmpty({ message: 'saleId es requerido' })
  saleId!: string

  @ApiProperty({ example: 'uuid-de-la-empresa' })
  @IsString()
  @IsNotEmpty({ message: 'companyId es requerido' })
  companyId!: string

  @ApiPropertyOptional({ example: 'uuid-del-cliente' })
  @IsOptional()
  @IsString()
  customerId?: string
}
