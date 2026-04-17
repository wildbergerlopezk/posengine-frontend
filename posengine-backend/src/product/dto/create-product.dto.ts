import {
    IsNotEmpty,
    IsString,
    MinLength,
    MaxLength,
    IsNumber,
    IsUUID,
    IsOptional,
    Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
    @ApiProperty({ example: 'Cámara 18x300' })
    @IsString()
    @IsNotEmpty({ message: 'Name is required' })
    @MinLength(3)
    @MaxLength(150)
    @Transform(({ value }) => value?.trim())
    name!: string;

    @ApiProperty({ example: 25000 })
    @IsNumber()
    @Min(0)
    price!: number;

    @ApiProperty({ example: 'cat-uuid-here' })
    @IsString()
    @IsNotEmpty({ message: 'CategoryId is required' })
    @IsUUID(4, { message: 'CategoryId must be a valid UUID' })
    categoryId!: string;

    @ApiProperty({ example: 'sub-uuid-here', required: false, nullable: true })
    @IsOptional()
    @IsUUID(4, { message: 'SubcategoryId must be a valid UUID' })
    subcategoryId?: string | null;
}
