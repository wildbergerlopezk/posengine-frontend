import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator'

export class CreatePurchaseDebtPaymentDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive()
  amount!: number

  @ApiPropertyOptional({ example: '2026-04-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string

  @ApiPropertyOptional({ description: 'Si el pago sale de una sesión de caja abierta' })
  @IsOptional()
  @IsString()
  cashSessionId?: string

  @ApiPropertyOptional({
    description: 'Cuota específica a la que se aplica el pago. Si no se manda, se va completando cuota por cuota en orden (FIFO)',
  })
  @IsOptional()
  @IsString()
  installmentId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string
}
