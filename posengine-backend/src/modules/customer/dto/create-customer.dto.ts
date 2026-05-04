import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsEmail,
  MinLength,
  Matches,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { DocumentType } from '../../../generated/prisma/enums'

@ValidatorConstraint({ name: 'isDocumentNumberValid', async: false })
export class IsDocumentNumberValidConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    const dto = args.object as any
    const type = dto.documentType || DocumentType.CI
    if (type === DocumentType.CI) {
      return /^(\d{1,3}(\.?\d{3}){2})$|^\d{5,8}$/.test(value)
    }
    if (type === DocumentType.RUC) {
      return /^\d{5,9}-\d$/.test(value)
    }
    return false
  }

  defaultMessage(args: ValidationArguments) {
    const dto = args.object as any
    const type = dto.documentType || DocumentType.CI
    if (type === DocumentType.RUC) {
      return 'RUC inválido. Formato esperado: 12345678-9'
    }
    return 'CI inválido. Ejemplos: 1.234.567 o 1234567'
  }
}

export class CreateCustomerDto {
  @ApiProperty({ example: 'Juan' })
  @IsString({ message: 'el nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'el nombre es requerido' })
  @MinLength(2, { message: 'el nombre debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'el nombre no puede exceder los 50 caracteres' })
  @Transform(({ value }) => value?.trim())
  name!: string

  @ApiPropertyOptional({ enum: DocumentType, default: DocumentType.CI })
  @IsOptional()
  @IsEnum(DocumentType, { message: 'tipo de documento debe ser RUC o CI' })
  documentType?: DocumentType

  @ApiPropertyOptional({ example: '5.123.456' })
  @IsOptional()
  @IsString({ message: 'el número de documento debe ser una cadena de texto' })
  @Validate(IsDocumentNumberValidConstraint)
  @Transform(({ value }) => value?.trim() || undefined)
  documentNumber?: string

  @ApiPropertyOptional({ example: '(0981)234567' })
  @IsOptional()
  @IsString({ message: 'el teléfono debe ser una cadena de texto' })
  @Matches(/^[\d\s()+-]{7,20}$/, {
    message: 'Número de teléfono inválido. Ej: (0981) 234 567',
  })
  @Transform(({ value }) => value?.replace(/[\s()+-]/g, '') || undefined)
  phone?: string

  @ApiPropertyOptional({ example: 'juan@email.com' })
  @IsOptional()
  @IsEmail({}, { message: 'email debe ser una dirección válida' })
  @Transform(({ value }) => value?.trim() || undefined)
  email?: string

  @ApiPropertyOptional({ example: 'Av. Mariscal López 1234' })
  @IsOptional()
  @IsString({ message: 'la dirección debe ser una cadena de texto' })
  @MaxLength(250, { message: 'la dirección no puede exceder los 250 caracteres' })
  @Transform(({ value }) => value?.trim() || undefined)
  address?: string

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'creditEnabled debe ser un valor booleano' })
  creditEnabled?: boolean
  
  @ApiPropertyOptional({ default: 0, description: 'Límite de crédito en Gs.' })
  @IsOptional()
  @IsNumber({}, { message: 'el límite de crédito debe ser un número' })
  @Min(0, { message: 'el límite de crédito no puede ser negativo' })
  @Type(() => Number)
  creditLimit?: number
}