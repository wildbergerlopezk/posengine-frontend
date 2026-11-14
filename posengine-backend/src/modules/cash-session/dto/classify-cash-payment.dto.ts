import { IsIn, IsString, Length } from 'class-validator'

export class ClassifyCashPaymentDto {
  @IsString()
  @IsIn(['CASH', 'TRANSFER', 'CARD'])
  paymentMethod!: 'CASH' | 'TRANSFER' | 'CARD'

  @IsString()
  @Length(3, 500)
  reason!: string
}
