import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentMethod } from '../../../generated/prisma/enums'

export class CreateCustomerPaymentDto {
  @ApiProperty({ example: 'uuid-del-cliente' })
  @IsString()
  @IsNotEmpty({ message: 'customerId es requerido' })
  customerId!: string

  @ApiPropertyOptional({
    description: 'Si se especifica, el pago se aplica al saldo pendiente de esta venta puntual. Si se omite, es un pago general a cuenta del cliente.',
  })
  @IsString()
  @IsOptional()
  saleId?: string

  @ApiProperty({ example: 100000, description: 'Monto abonado (Gs.)' })
  @IsNumber({}, { message: 'amount debe ser un número' })
  @IsPositive({ message: 'amount debe ser mayor a 0' })
  amount!: number

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod, { message: 'paymentMethod inválido' })
  @IsNotEmpty({ message: 'paymentMethod es requerido' })
  paymentMethod!: PaymentMethod

  @ApiPropertyOptional({ example: 'Pago de cuota mensual' })
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'la observación no puede exceder los 300 caracteres' })
  notes?: string
}
