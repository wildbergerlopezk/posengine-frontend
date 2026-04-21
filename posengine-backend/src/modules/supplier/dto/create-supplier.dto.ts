import {
  IsNotEmpty,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Comercial JK' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del proveedor es requerido' })
  @MinLength(3)
  @MaxLength(150)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiPropertyOptional({ example: '123 Main St' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiPropertyOptional({ example: '+595971123456' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9]{7,15}$/, {
    message: 'Número de teléfono inválido',
  })
  @Transform(({ value }) => value?.replace(/\s+/g, ''))
  phone?: string;

  @ApiPropertyOptional({ example: '80012345-6' })
  @IsString()
@IsNotEmpty({ message: 'El RUC del proveedor es requerido' })
  @Matches(/^\d{5,9}-\d$/, {
    message: 'RUC inválido. Formato esperado: 12345678-9',
  })
  @Transform(({ value }) => value?.trim())
  RUC!: string;
}