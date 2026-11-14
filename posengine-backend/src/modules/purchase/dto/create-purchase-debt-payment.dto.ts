import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator'
import { PaymentMethod } from '../../../generated/prisma/enums'

export class CreatePurchaseDebtPaymentDto {
  @ApiProperty({ example: 50000 })
  @IsNumber()
  @IsPositive()
  amount!: number

  @ApiProperty({ enum: [PaymentMethod.CASH, PaymentMethod.TRANSFER] })
  @IsIn([PaymentMethod.CASH, PaymentMethod.TRANSFER], {
    message: 'paymentMethod debe ser CASH o TRANSFER',
  })
  paymentMethod!: PaymentMethod

  @ApiPropertyOptional({ example: '2026-04-20T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string

  @ApiPropertyOptional({ description: 'Sesión abierta a la que se atribuye el pago durante la caja actual' })
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
