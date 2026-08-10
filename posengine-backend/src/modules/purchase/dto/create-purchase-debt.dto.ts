import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray, IsDateString, IsEnum, IsInt, IsNumber,
  IsOptional, IsPositive, ValidateNested,
} from 'class-validator'
import { PurchaseDebtScheduleType } from '../../../generated/prisma/enums'

export class CreatePurchaseDebtInstallmentDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  number!: number

  @ApiProperty({ example: 100000 })
  @IsNumber()
  @IsPositive()
  amount!: number

  @ApiProperty({ example: '2026-05-01T00:00:00.000Z' })
  @IsDateString()
  dueDate!: string
}

export class CreatePurchaseDebtDto {
  @ApiProperty({ enum: PurchaseDebtScheduleType, example: PurchaseDebtScheduleType.NONE })
  @IsEnum(PurchaseDebtScheduleType)
  scheduleType!: PurchaseDebtScheduleType

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string // requerido si scheduleType === NONE

  @ApiPropertyOptional({ type: [CreatePurchaseDebtInstallmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseDebtInstallmentDto)
  installments?: CreatePurchaseDebtInstallmentDto[] // requerido si scheduleType !== NONE
}
