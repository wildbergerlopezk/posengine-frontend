import {
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
    IsUUID,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubcategoryDto {
    @ApiProperty({ example: 'Motocicleta' })
    @IsString()
    @IsNotEmpty({ message: 'Name is required' })
    @MinLength(3)
    @MaxLength(100)
    @Transform(({ value }) => value?.trim())
    name!: string;

    @ApiProperty({ example: 'cat-uuid-here' })
    @IsString()
    @IsNotEmpty({ message: 'CategoryId is required' })
    @IsUUID(4, { message: 'CategoryId must be a valid UUID' })
    categoryId!: string;
}
