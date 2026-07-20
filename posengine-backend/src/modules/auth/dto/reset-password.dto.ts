import { IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {

  @ApiProperty({
    description: 'Token recibido por correo',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({
    description: 'Nueva contraseña',
    example: 'NuevaPassword123!',
  })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  password!: string;

}