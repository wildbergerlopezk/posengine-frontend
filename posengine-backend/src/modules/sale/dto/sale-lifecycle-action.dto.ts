import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class SaleLifecycleActionDto {
  @ApiProperty({ description: 'Motivo auditable para cancelar o restaurar la venta' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string
}
