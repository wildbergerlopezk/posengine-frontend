import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token entregado en el login' })
  @IsString()
  @IsNotEmpty({ message: 'El refresh token es requerido' })
  refreshToken!: string;
}
