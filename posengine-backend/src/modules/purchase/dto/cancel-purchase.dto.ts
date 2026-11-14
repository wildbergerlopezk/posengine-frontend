import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator'

export class CancelPurchaseDto {
  @ApiProperty({ description: 'Motivo auditable de la corrección' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string

  @ApiProperty({ description: 'Confirmación explícita: el proveedor no recibió el pago' })
  @IsBoolean()
  supplierReceivedNothing!: boolean
}
