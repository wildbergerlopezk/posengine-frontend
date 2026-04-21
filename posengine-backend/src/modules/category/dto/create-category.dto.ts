import {
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({ example: 'Repuestos' })
    @IsString()
    @IsNotEmpty({ message: 'Name is required' })
    @MinLength(3)
    @MaxLength(100)
    @Transform(({ value }) => value?.trim())
    name!: string;
}

