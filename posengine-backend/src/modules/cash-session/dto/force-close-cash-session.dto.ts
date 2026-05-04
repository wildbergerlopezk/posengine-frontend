import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Equals,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ForceCloseCashSessionDto {
  @ApiProperty({
    example: 1350000,
    description: 'Monto en efectivo contado físicamente al cerrar la caja (Gs.)',
  })
  @IsNumber({}, { message: 'el monto contado debe ser un número' })
  @Min(0, { message: 'el monto contado no puede ser negativo' })
  @Max(999_999_999, { message: 'el monto contado excede el límite permitido' })
  @Type(() => Number)
  closingAmount!: number

  @ApiProperty({
    example: 'CERRAR',
    description: 'El usuario debe escribir exactamente "CERRAR" para confirmar el cierre forzado',
  })
  @IsString()
  @Equals('CERRAR', { message: 'debés escribir exactamente "CERRAR" para confirmar el cierre forzado' })
  @Transform(({ value }) => value?.trim())
  confirmation!: string

  @ApiPropertyOptional({ example: 'Necesito cerrar antes de tiempo por emergencia' })
  @IsOptional()
  @IsString({ message: 'la razón debe ser una cadena de texto' })
  @MaxLength(300, { message: 'la razón no puede exceder los 300 caracteres' })
  @Transform(({ value }) => value?.trim() || undefined)
  forceReason?: string
}