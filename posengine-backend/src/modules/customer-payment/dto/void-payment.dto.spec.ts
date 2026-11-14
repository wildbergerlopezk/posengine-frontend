import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { VoidPaymentDto } from './void-payment.dto'

describe('VoidPaymentDto', () => {
  it('requires a non-empty correction reason', async () => {
    const dto = plainToInstance(VoidPaymentDto, { reason: '   ' })

    await expect(validate(dto)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ property: 'reason' }),
    ]))
  })

  it('rejects a missing reason', async () => {
    const errors = await validate(plainToInstance(VoidPaymentDto, {}))

    expect(errors.map((error) => error.property)).toContain('reason')
  })

  it('trims and accepts a clear correction reason', async () => {
    const dto = plainToInstance(VoidPaymentDto, { reason: '  Captura duplicada no recibida  ' })

    await expect(validate(dto)).resolves.toHaveLength(0)
    expect(dto.reason).toBe('Captura duplicada no recibida')
  })
})
