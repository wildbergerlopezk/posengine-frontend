import { ServiceUnavailableException } from '@nestjs/common'
import { CommercialOperationPolicy } from './commercial-operation-policy'

describe('CommercialOperationPolicy', () => {
  const flags = [
    'POSENGINE_ENABLE_PURCHASE_RETURNS',
    'POSENGINE_ENABLE_PURCHASE_SETTLEMENTS',
    'POSENGINE_ENABLE_SUPPLIER_CREDIT_APPLICATIONS',
    'POSENGINE_ENABLE_SALE_RETURNS',
    'POSENGINE_ENABLE_SALE_REFUNDS',
    'POSENGINE_ENABLE_PURCHASE_CANCELLATIONS',
    'POSENGINE_ENABLE_SALE_CANCELLATIONS',
    'POSENGINE_ENABLE_SALE_RESTORATIONS',
  ]
  const originalValues = Object.fromEntries(flags.map((flag) => [flag, process.env[flag]]))

  afterEach(() => {
    for (const flag of flags) {
      const originalValue = originalValues[flag]
      if (originalValue === undefined) delete process.env[flag]
      else process.env[flag] = originalValue
    }
  })

  it.each([
    'PURCHASE_RETURNS', 'PURCHASE_RETURN_SETTLEMENTS', 'SUPPLIER_CREDIT_APPLICATIONS',
    'SALE_RETURNS', 'SALE_RETURN_REFUNDS', 'PURCHASE_CANCELLATIONS', 'SALE_CANCELLATIONS', 'SALE_RESTORATIONS',
  ] as const)(
    'blocks %s by default',
    (operation) => {
      for (const flag of flags) delete process.env[flag]
      expect(() => CommercialOperationPolicy.assertEnabled(operation)).toThrow(ServiceUnavailableException)
    },
  )

  it('requires the exact explicit opt-in value', () => {
    process.env.POSENGINE_ENABLE_PURCHASE_RETURNS = '1'
    expect(() => CommercialOperationPolicy.assertEnabled('PURCHASE_RETURNS')).toThrow(ServiceUnavailableException)
  })

  it('allows only the operation explicitly enabled', () => {
    process.env.POSENGINE_ENABLE_PURCHASE_RETURNS = 'true'
    expect(() => CommercialOperationPolicy.assertEnabled('PURCHASE_RETURNS')).not.toThrow()
    expect(() => CommercialOperationPolicy.assertEnabled('SALE_CANCELLATIONS')).toThrow(ServiceUnavailableException)
  })

  it('reports each independent capability and the backend reason without exposing flag names', () => {
    for (const flag of flags) delete process.env[flag]
    process.env.POSENGINE_ENABLE_SALE_RETURNS = 'true'
    process.env.POSENGINE_ENABLE_SALE_REFUNDS = 'true'

    const capabilities = CommercialOperationPolicy.getCapabilities()

    expect(capabilities.saleReturns).toEqual({ enabled: true, reason: null })
    expect(capabilities.saleReturnRefunds).toEqual({ enabled: true, reason: null })
    expect(capabilities.purchaseReturns.enabled).toBe(false)
    expect(capabilities.purchaseReturns.reason).toMatch(/devoluciones de compras/i)
    expect(JSON.stringify(capabilities)).not.toContain('POSENGINE_ENABLE_')
    expect(Object.keys(capabilities)).toHaveLength(8)
  })
})
