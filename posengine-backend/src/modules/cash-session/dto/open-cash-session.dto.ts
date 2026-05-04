import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class OpenCashSessionDto {
  @ApiProperty({
    example: 500000,
    description: 'Monto en efectivo contado al momento de abrir la caja (Gs.)',
  })
  @IsNumber({}, { message: 'el monto inicial debe ser un número' })
  @Min(0, { message: 'el monto inicial no puede ser negativo' })
  @Max(999_999_999, { message: 'el monto inicial excede el límite permitido' })
  @Type(() => Number)
  openingAmount!: number

  @ApiPropertyOptional({ example: 'Apertura del turno mañana' })
  @IsOptional()
  @IsString({ message: 'la observación debe ser una cadena de texto' })
  @MaxLength(300, { message: 'la observación no puede exceder los 300 caracteres' })
  @Transform(({ value }) => value?.trim() || undefined)
  notes?: string
}