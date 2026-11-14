import { Transform } from 'class-transformer'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class VoidPaymentDto {
  @ApiProperty({ example: 'Cobro ingresado por error; no se recibió el dinero' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty({ message: 'Indicá el motivo de la corrección del pago.' })
  @MaxLength(300, { message: 'el motivo no puede exceder los 300 caracteres' })
  reason!: string
}
