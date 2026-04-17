import { IsEmail, IsString, IsNotEmpty, IsOptional,IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'juan.perez@example.com',
    required: true,
  })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @IsNotEmpty({ message: 'El correo electrónico no puede estar vacío' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'JuanPerez123_',
    required: true,
  })
  @IsString({ message: 'La contraseña debe ser un texto' })
  @IsNotEmpty({ message: 'La contraseña no puede estar vacía' })
  password!: string;

  @ApiProperty({
    description: 'Indica si el usuario desea mantener la sesión iniciada',
    example: true,
    required: false,
  })

  @ApiProperty({
    description: 'Recordar sesión',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isRemember?: boolean;
}