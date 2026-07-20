import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {

  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@example.com',
  })
  @IsEmail({}, { message: 'El correo electrónico debe ser válido' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  email!: string;

}