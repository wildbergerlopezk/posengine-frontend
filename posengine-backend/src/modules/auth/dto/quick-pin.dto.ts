import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

export class SetupQuickPinDto {
  @ApiProperty({ example: 'CurrentPassword123' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  pin!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  confirmPin!: string;
}

export class DisableQuickPinDto {
  @ApiProperty({ example: 'CurrentPassword123' })
  @IsString()
  @MinLength(1)
  password!: string;
}

export class LoginQuickPinDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  pin!: string;
}
