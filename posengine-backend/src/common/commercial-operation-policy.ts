import { ServiceUnavailableException } from '@nestjs/common'

export type HighRiskCommercialOperation =
  | 'PURCHASE_RETURNS'
  | 'PURCHASE_RETURN_SETTLEMENTS'
  | 'SUPPLIER_CREDIT_APPLICATIONS'
  | 'SALE_RETURNS'
  | 'SALE_RETURN_REFUNDS'
  | 'PURCHASE_CANCELLATIONS'
  | 'SALE_CANCELLATIONS'
  | 'SALE_RESTORATIONS'

const operationFlags: Record<HighRiskCommercialOperation, string> = {
  PURCHASE_RETURNS: 'POSENGINE_ENABLE_PURCHASE_RETURNS',
  PURCHASE_RETURN_SETTLEMENTS: 'POSENGINE_ENABLE_PURCHASE_SETTLEMENTS',
  SUPPLIER_CREDIT_APPLICATIONS: 'POSENGINE_ENABLE_SUPPLIER_CREDIT_APPLICATIONS',
  SALE_RETURNS: 'POSENGINE_ENABLE_SALE_RETURNS',
  SALE_RETURN_REFUNDS: 'POSENGINE_ENABLE_SALE_REFUNDS',
  PURCHASE_CANCELLATIONS: 'POSENGINE_ENABLE_PURCHASE_CANCELLATIONS',
  SALE_CANCELLATIONS: 'POSENGINE_ENABLE_SALE_CANCELLATIONS',
  SALE_RESTORATIONS: 'POSENGINE_ENABLE_SALE_RESTORATIONS',
}

const disabledMessages: Record<HighRiskCommercialOperation, string> = {
  PURCHASE_RETURNS:
    'Las devoluciones de compras están temporalmente deshabilitadas mientras se protege la integridad comercial.',
  PURCHASE_RETURN_SETTLEMENTS:
    'La liquidación de devoluciones de compras está temporalmente deshabilitada.',
  SUPPLIER_CREDIT_APPLICATIONS:
    'La aplicación de créditos de proveedores está temporalmente deshabilitada.',
  SALE_RETURNS:
    'Las devoluciones de ventas están temporalmente deshabilitadas mientras se verifica su integridad comercial.',
  SALE_RETURN_REFUNDS:
    'Los reembolsos de ventas están temporalmente deshabilitados.',
  PURCHASE_CANCELLATIONS:
    'La anulación de compras está temporalmente deshabilitada mientras se protege la integridad de caja e inventario.',
  SALE_CANCELLATIONS:
    'La anulación y restauración de ventas están temporalmente deshabilitadas mientras se protege la integridad comercial.',
  SALE_RESTORATIONS:
    'La restauración de ventas está temporalmente deshabilitada.',
}

/**
 * Temporary server-side kill switch for commercial flows awaiting financial rules.
 * Operations remain blocked unless an operator explicitly opts in. The guarded
 * PostgreSQL integration harness enables them only after validating its test DB.
 */
export class CommercialOperationPolicy {
  private static isEnabled(operation: HighRiskCommercialOperation): boolean {
    return process.env[operationFlags[operation]] === 'true'
  }

  private static capability(operation: HighRiskCommercialOperation) {
    const enabled = this.isEnabled(operation)
    return { enabled, reason: enabled ? null : disabledMessages[operation] }
  }

  /** Returns safe, user-facing availability without exposing environment variable names. */
  static getCapabilities() {
    return {
      purchaseReturns: this.capability('PURCHASE_RETURNS'),
      purchaseReturnSettlements: this.capability('PURCHASE_RETURN_SETTLEMENTS'),
      supplierCreditApplications: this.capability('SUPPLIER_CREDIT_APPLICATIONS'),
      saleReturns: this.capability('SALE_RETURNS'),
      saleReturnRefunds: this.capability('SALE_RETURN_REFUNDS'),
      purchaseCancellations: this.capability('PURCHASE_CANCELLATIONS'),
      saleCancellations: this.capability('SALE_CANCELLATIONS'),
      saleRestorations: this.capability('SALE_RESTORATIONS'),
    }
  }

  static assertEnabled(operation: HighRiskCommercialOperation): void {
    if (this.isEnabled(operation)) return
    throw new ServiceUnavailableException(disabledMessages[operation])
  }
}
