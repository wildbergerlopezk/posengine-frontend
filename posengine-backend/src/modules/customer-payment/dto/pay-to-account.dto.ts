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

export class PayToAccountDto {
  @ApiProperty({ example: 'uuid-del-cliente' })
  @IsString()
  @IsNotEmpty({ message: 'customerId es requerido' })
  customerId!: string

  @ApiProperty({ example: 4500000, description: 'Monto total a cuenta, se distribuye automáticamente entre las ventas pendientes más antiguas' })
  @IsNumber({}, { message: 'amount debe ser un número' })
  @IsPositive({ message: 'amount debe ser mayor a 0' })
  amount!: number

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod, { message: 'paymentMethod inválido' })
  @IsNotEmpty({ message: 'paymentMethod es requerido' })
  paymentMethod!: PaymentMethod

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'la observación no puede exceder los 300 caracteres' })
  notes?: string
}
