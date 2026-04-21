import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  name!: string;

  @ApiProperty({ example: 'juan@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(254)
  @Transform(({ value }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({ example: 'Password123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_-])[A-Za-z\d@$!%*?&_-]{8,}$/, {
    message:
      'Password must be at least 8 characters long, contain uppercase, lowercase, number and special character',
  })
  @Transform(({ value }) => value?.trim())
  password!: string;

  @ApiProperty({ example: 'Aqua Gestión' })
  @IsString()
  @IsNotEmpty({ message: 'Tenant name is required' })
  @MinLength(3)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  tenantName!: string;

}