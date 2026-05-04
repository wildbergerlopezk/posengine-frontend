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

export class CloseCashSessionDto {
  @ApiProperty({
    example: 1350000,
    description: 'Monto en efectivo contado físicamente al cerrar la caja (Gs.)',
  })
  @IsNumber({}, { message: 'el monto contado debe ser un número' })
  @Min(0, { message: 'el monto contado no puede ser negativo' })
  @Max(999_999_999, { message: 'el monto contado excede el límite permitido' })
  @Type(() => Number)
  closingAmount!: number

  @ApiPropertyOptional({ example: 'Todo en orden al cierre' })
  @IsOptional()
  @IsString({ message: 'la observación debe ser una cadena de texto' })
  @MaxLength(300, { message: 'la observación no puede exceder los 300 caracteres' })
  @Transform(({ value }) => value?.trim() || undefined)
  notes?: string
}