import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsString,
  MaxLength,
  Min,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { CashMovementType } from '../../../generated/prisma/enums'

export class CreateCashMovementDto {
  @ApiProperty({
    example: 100000,
    description: 'Monto del movimiento manual en Gs.',
  })
  @IsNumber({}, { message: 'el monto debe ser un número' })
  @Min(1, { message: 'el monto debe ser mayor a 0' })
  @Type(() => Number)
  amount!: number

  @ApiProperty({
    enum: CashMovementType,
    example: 'OUT',
    description: 'Tipo de movimiento: IN (Ingreso) o OUT (Egreso)',
  })
  @IsEnum(CashMovementType, { message: 'tipo de movimiento inválido (IN o OUT)' })
  type!: CashMovementType

  @ApiProperty({
    example: 'Retiro para compra de insumos de limpieza',
    description: 'Descripción/Motivo del movimiento manual',
  })
  @IsString({ message: 'la descripción debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'la descripción no puede estar vacía' })
  @MaxLength(300, { message: 'la descripción no puede exceder los 300 caracteres' })
  @Transform(({ value }) => value?.trim())
  description!: string
}
