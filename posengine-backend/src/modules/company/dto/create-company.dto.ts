import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsNumber,
  Min,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompanyDto {
  @ApiProperty({ example: 'mi-empresa' })
  @IsString({ message: 'el slug debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'el slug es requerido' })
  @Transform(({ value }) => value?.trim()?.toLowerCase())
  slug!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'active debe ser un valor booleano' })
  active?: boolean;

  @ApiProperty({ example: 'Mi Empresa Sociedad Anónima' })
  @IsString({ message: 'la razón social debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'la razón social es requerida' })
  @Transform(({ value }) => value?.trim())
  legalName!: string;

  @ApiPropertyOptional({ example: 'Mi Empresa' })
  @IsOptional()
  @IsString({ message: 'el nombre de fantasía debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim() || undefined)
  tradeName?: string;

  @ApiProperty({ example: '80012345-6' })
  @IsString({ message: 'el RUC debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'el RUC es requerido' })
  @Transform(({ value }) => value?.trim())
  taxId!: string;

  @ApiProperty({ example: 'Av. España 123' })
  @IsString({ message: 'la dirección debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'la dirección es requerida' })
  @Transform(({ value }) => value?.trim())
  address!: string;

  @ApiProperty({ example: 'Asunción' })
  @IsString({ message: 'la ciudad debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'la ciudad es requerida' })
  @Transform(({ value }) => value?.trim())
  city!: string;

  @ApiPropertyOptional({ example: 'Central' })
  @IsOptional()
  @IsString({ message: 'el departamento/estado debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim() || undefined)
  state?: string;

  @ApiPropertyOptional({ example: '021234567' })
  @IsOptional()
  @IsString({ message: 'el teléfono debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim() || undefined)
  phone?: string;

  @ApiPropertyOptional({ example: 'contacto@miempresa.com' })
  @IsOptional()
  @IsEmail({}, { message: 'el correo electrónico debe ser una dirección válida' })
  @Transform(({ value }) => value?.trim() || undefined)
  email?: string;

  @ApiPropertyOptional({ example: 'Venta de productos y servicios' })
  @IsOptional()
  @IsString({ message: 'la actividad económica debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim() || undefined)
  economicActivity?: string;

  @ApiPropertyOptional({ example: '001-001', default: '001-001' })
  @IsOptional()
  @IsString({ message: 'el punto de emisión debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim() || undefined)
  emissionPoint?: string;

  @ApiPropertyOptional({ example: 'https://miempresa.com/logo.png' })
  @IsOptional()
  @IsString({ message: 'la URL del logo debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim() || undefined)
  logoUrl?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @IsOptional()
  @IsString({ message: 'el número de timbrado debe ser una cadena de texto' })
  @Transform(({ value }) => value?.trim() || undefined)
  stampNumber?: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'la fecha de inicio del timbrado debe ser una fecha válida' })
  stampStartDate?: string;
}
