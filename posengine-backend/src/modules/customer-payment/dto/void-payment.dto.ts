import { IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class VoidPaymentDto {
  @ApiPropertyOptional({ example: 'Monto cargado por error' })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'el motivo no puede exceder los 300 caracteres' })
  reason?: string
}
