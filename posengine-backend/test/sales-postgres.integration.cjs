// Real PostgreSQL integration checks. Run only with the guarded local test URL.
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')

const expectedHost = '127.0.0.1'
const expectedPort = '55439'
const expectedDatabase = 'posengine_sales_test'
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL must point to the isolated integration database')
const parsedUrl = new URL(databaseUrl)
if (
  parsedUrl.hostname !== expectedHost ||
  parsedUrl.port !== expectedPort ||
  parsedUrl.pathname !== `/${expectedDatabase}`
) {
  throw new Error('Refusing to run: DATABASE_URL is not the guarded local sales test database')
}

// The high-risk services remain disabled by default. Only this script opts in
// after its exact throwaway PostgreSQL target is validated in main().

const { PrismaService } = require('../dist/src/prisma/prisma.service.js')
const { SaleService } = require('../dist/src/modules/sale/services/sale.service.js')
const { SaleValidationService } = require('../dist/src/modules/sale/services/sale-validation.service.js')
const { SaleCreditService } = require('../dist/src/modules/sale/services/sale-credit.service.js')
const { StockMovementService } = require('../dist/src/modules/stock-movement/stock-movement.service.js')
const { ProductService } = require('../dist/src/modules/product/product.service.js')
const { CustomerService } = require('../dist/src/modules/customer/customer.service.js')
const { CashSessionService } = require('../dist/src/modules/cash-session/cash-session.service.js')
const { DashboardService } = require('../dist/src/modules/dashboard/services/dashboard.service.js')
const { CustomerPaymentService } = require('../dist/src/modules/customer-payment/customer-payment.service.js')
const { PurchaseDebtService } = require('../dist/src/modules/purchase/services/purchase-debt.service.js')
const { PurchaseService } = require('../dist/src/modules/purchase/services/purchase.service.js')
const { PurchaseValidationService } = require('../dist/src/modules/purchase/services/purchase-validation.service.js')
const { PurchaseReturnService } = require('../dist/src/modules/purchase/services/purchase-return.service.js')
const { SaleReturnService } = require('../dist/src/modules/sale/services/sale-return.service.js')
const { RefreshTokenService } = require('../dist/src/modules/auth/services/refresh-token.service.js')
const { LogoutService } = require('../dist/src/modules/auth/services/logout.service.js')
const { LoginService } = require('../dist/src/modules/auth/services/login.service.js')
const { QuickPinService } = require('../dist/src/modules/auth/services/quick-pin.service.js')
const { TokenService } = require('../dist/src/modules/auth/services/token.service.js')
const { UserService } = require('../dist/src/modules/user/user.service.js')
const { hashToken } = require('../dist/src/modules/auth/utils/hash-token.util.js')
const bcrypt = require('bcrypt')
const { PaymentMethod, PaymentStatus, PriceType } = require('../dist/src/generated/prisma/enums.js')

const prisma = new PrismaService()
const performanceResults = []
const tests = []
let nextTransactionCounts = null
let latestTransactionCounts = {}
let latestSaleLog = null
let latestRawQueryShape = null

function test(name, run) {
  tests.push({ name, run })
}

function countOperation(counts, name) {
  counts[name] = (counts[name] || 0) + 1
}

function instrumentTransactionClient(tx, counts) {
  return new Proxy(tx, {
    get(target, property) {
      const value = Reflect.get(target, property, target)
      if (property === '$queryRaw' || property === '$executeRaw') {
        return (...args) => {
          countOperation(counts, String(property))
          if (property === '$queryRaw') {
            latestRawQueryShape = {
              template: Array.from(args[0] || []).join('?'),
              values: args.slice(1),
            }
          }
          return value.apply(target, args)
        }
      }
      if (value && typeof value === 'object') {
        return new Proxy(value, {
          get(delegate, operation) {
            const method = Reflect.get(delegate, operation, delegate)
            if (typeof method !== 'function') return method
            return (...args) => {
              countOperation(counts, `${String(property)}.${String(operation)}`)
              return method.apply(delegate, args)
            }
          },
        })
      }
      return value
    },
  })
}

function makeSaleService(stockMovementService = new StockMovementService(prisma), saleCreditService = new SaleCreditService(prisma)) {
  const countsByTransaction = []
  const transactionPrisma = new Proxy({
    $transaction: (callback, options) => {
      const counts = {}
      return prisma.$transaction(async (tx) => {
        try {
          return await callback(instrumentTransactionClient(tx, counts))
        } finally {
          latestTransactionCounts = counts
          countsByTransaction.push(counts)
        }
      }, options)
    },
  }, {
    get(target, property, receiver) {
      if (Reflect.has(target, property)) return Reflect.get(target, property, receiver)
      const value = prisma[property]
      return typeof value === 'function' ? value.bind(prisma) : value
    },
  })

  const productService = new ProductService(prisma, stockMovementService)
  const validation = new SaleValidationService(prisma, productService)
  const service = new SaleService(transactionPrisma, stockMovementService, validation, saleCreditService)
  service.logger.log = (message) => {
    try { latestSaleLog = JSON.parse(message) } catch { latestSaleLog = null }
  }
  return { service, countsByTransaction }
}

function makeCustomerPaymentService() {
  return new CustomerPaymentService(prisma)
}

function makePurchaseReturnService(prismaClient = prisma) {
  return new PurchaseReturnService(prismaClient)
}

function makeSaleReturnService(prismaClient = prisma) {
  return new SaleReturnService(prismaClient)
}

function makePurchaseService(stockMovementService = new StockMovementService(prisma)) {
  const productService = new ProductService(prisma, stockMovementService)
  const validation = new PurchaseValidationService(prisma, productService)
  const debtService = new PurchaseDebtService(prisma)
  return new PurchaseService(prisma, stockMovementService, validation, debtService)
}

async function createPurchaseWithItem(fixture, quantity = 5, { paymentType = 'CASH', product = fixture.products[0] } = {}) {
  const supplier = await prisma.supplier.create({
    data: { tenantId: fixture.tenant.id, name: `Return supplier ${randomUUID()}` },
  })
  const purchase = await prisma.purchase.create({
    data: {
      tenantId: fixture.tenant.id,
      supplierId: supplier.id,
      invoiceNumber: `return-${randomUUID()}`,
      purchaseDate: new Date(),
      paymentType,
      total: quantity * 20,
      cashSessionId: fixture.cashSession.id,
    },
  })
  const item = await prisma.purchaseItem.create({
    data: { purchaseId: purchase.id, productId: product.id, quantity, unitCost: 20, total: quantity * 20 },
  })
  return { supplier, purchase, item }
}

function createReturnDto(purchase, items) {
  return { purchaseId: purchase.id, returnDate: new Date().toISOString(), reason: 'Integration fixture', items }
}

function confirmReturn(service, returned, tenantId, settlementDisposition = 'REFUND_PENDING') {
  return service.confirm(returned.id, tenantId, { settlementDisposition })
}

async function createSupplierDebt(fixture) {
  const supplier = await prisma.supplier.create({
    data: { tenantId: fixture.tenant.id, name: `Supplier ${randomUUID()}` },
  })
  const purchase = await prisma.purchase.create({
    data: {
      tenantId: fixture.tenant.id,
      supplierId: supplier.id,
      invoiceNumber: `invoice-${randomUUID()}`,
      purchaseDate: new Date(),
      paymentType: 'CREDIT',
      total: 100,
      cashSessionId: fixture.cashSession.id,
    },
  })
  const debt = await prisma.purchaseDebt.create({
    data: {
      tenantId: fixture.tenant.id,
      purchaseId: purchase.id,
      totalAmount: 100,
      balance: 100,
    },
  })
  return { supplier, purchase, debt }
}

async function createFixture({ productCount = 1, stock = 10, creditLimit = 1_000_000, openingAmount = 0, openSession = true, unitType = 'UNIT' } = {}) {
  const suffix = randomUUID().replaceAll('-', '')
  const tenant = await prisma.tenant.create({
    data: { name: `Sales Integration ${suffix}`, slug: `sales-it-${suffix}` },
  })
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Integration Fixture User',
      email: `${suffix}@integration.invalid`,
      password: 'fixture-only-not-a-real-credential',
    },
  })
  const category = await prisma.category.create({
    data: { tenantId: tenant.id, name: `Category ${suffix}` },
  })
  const cashSession = openSession
    ? await prisma.cashSession.create({
        data: { tenantId: tenant.id, openedBy: user.id, openingAmount },
      })
    : null
  const customer = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      name: `Customer ${suffix}`,
      creditEnabled: true,
      creditLimit,
    },
  })
  const products = []
  for (let i = 0; i < productCount; i += 1) {
    products.push(await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        name: `Product ${i + 1} ${suffix}`,
        sku: `${suffix.slice(0, 12)}-${i + 1}`,
        price: 100,
        wholesalePrice: 50,
        cost: 25,
        stock,
        unitType,
      },
    }))
  }
  return { tenant, user, category, cashSession, customer, products }
}

async function cleanupFixture(fixture) {
  const where = { tenantId: fixture.tenant.id }
  await prisma.cashPaymentClassificationAudit.deleteMany({ where })
  await prisma.saleReturnRefundReceipt.deleteMany({ where })
  await prisma.saleReturnSettlement.deleteMany({ where })
  await prisma.saleReturnDebtAdjustment.deleteMany({ where })
  await prisma.saleReturnItem.deleteMany({ where: { saleReturn: where } })
  await prisma.saleReturn.deleteMany({ where })
  await prisma.saleLifecycleEvent.deleteMany({ where })
  await prisma.purchaseLifecycleEvent.deleteMany({ where })
  await prisma.purchaseReturnRefundReceipt.deleteMany({ where })
  await prisma.customerPayment.deleteMany({ where })
  await prisma.purchaseReturnCreditApplication.deleteMany({ where })
  await prisma.purchaseDebtAdjustment.deleteMany({ where })
  await prisma.purchaseReturnSettlement.deleteMany({ where })
  await prisma.purchaseDebtPayment.deleteMany({ where })
  await prisma.purchaseDebtInstallment.deleteMany({ where: { purchaseDebt: where } })
  await prisma.purchaseDebt.deleteMany({ where })
  await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: where } })
  await prisma.purchaseReturn.deleteMany({ where })
  await prisma.cashMovement.deleteMany({ where })
  await prisma.stockMovement.deleteMany({ where })
  await prisma.saleItem.deleteMany({ where: { sale: where } })
  await prisma.sale.deleteMany({ where })
  await prisma.purchaseItem.deleteMany({ where: { purchase: where } })
  await prisma.product.deleteMany({ where })
  await prisma.purchase.deleteMany({ where })
  await prisma.supplier.deleteMany({ where })
  await prisma.customer.deleteMany({ where })
  await prisma.cashSession.deleteMany({ where })
  await prisma.category.deleteMany({ where })
  await prisma.user.deleteMany({ where })
  await prisma.tenant.delete({ where: { id: fixture.tenant.id } })
}

async function fixtureTest(options, run) {
  const fixture = await createFixture(options)
  try { return await run(fixture) } finally { await cleanupFixture(fixture) }
}

test('concurrent refresh requests claim a token once and replay does not revoke unrelated sessions', () =>
  fixtureTest({}, async (fixture) => {
    const initial = await createRefreshToken(fixture)
    const unrelatedSession = await createRefreshToken(fixture)
    const refreshService = makeRefreshService()
    const heldLock = await holdUserRowLock(fixture)
    const attempts = Promise.allSettled([
      refreshService.refresh({ refreshToken: initial.rawToken }),
      refreshService.refresh({ refreshToken: initial.rawToken }),
    ])
    try {
      assert.ok(await waitForRefreshUserLockWaits(2) >= 2, 'both refresh transactions must overlap on the user row')
    } finally {
      heldLock.release()
    }
    await heldLock.transaction
    const outcomes = await attempts
    assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 1)

    const rotatedRoot = await prisma.refreshToken.findUnique({ where: { id: initial.token.id } })
    assert.ok(rotatedRoot.revokedAt)
    assert.ok(rotatedRoot.replacedBy)
    assert.equal(await prisma.refreshToken.count({ where: { userId: fixture.user.id, revokedAt: null } }), 2)
    await assert.rejects(refreshService.refresh({ refreshToken: initial.rawToken }))
    assert.equal(await prisma.refreshToken.count({ where: { tokenHash: unrelatedSession.tokenHash, revokedAt: null } }), 1)
    assert.equal(await prisma.refreshToken.count({ where: { userId: fixture.user.id, revokedAt: null } }), 2)
  }))

test('refresh rejects expired and revoked tokens without changing other active sessions', () =>
  fixtureTest({}, async (fixture) => {
    const expired = await createRefreshToken(fixture, { expiresAt: new Date(Date.now() - 1_000) })
    const revoked = await createRefreshToken(fixture, { revokedAt: new Date() })
    const active = await createRefreshToken(fixture)
    const refreshService = makeRefreshService()
    await assert.rejects(refreshService.refresh({ refreshToken: expired.rawToken }))
    await assert.rejects(refreshService.refresh({ refreshToken: revoked.rawToken }))
    assert.equal(await prisma.refreshToken.count({ where: { tokenHash: active.tokenHash, revokedAt: null } }), 1)
  }))

test('logout racing with refresh cannot leave an active descendant session', () =>
  fixtureTest({}, async (fixture) => {
    const initial = await createRefreshToken(fixture)
    const refreshService = makeRefreshService()
    const logoutService = new LogoutService(prisma)
    const heldLock = await holdUserRowLock(fixture)
    const refreshAttempt = refreshService.refresh({ refreshToken: initial.rawToken })
    const logoutAttempt = logoutService.logout({ refreshToken: initial.rawToken })
    try {
      assert.ok(await waitForRefreshUserLockWaits(2) >= 2, 'refresh and logout must overlap on the user row')
    } finally {
      heldLock.release()
    }
    await heldLock.transaction
    const [refreshOutcome, logoutOutcome] = await Promise.allSettled([refreshAttempt, logoutAttempt])
    assert.equal(logoutOutcome.status, 'fulfilled')
    assert.ok(['fulfilled', 'rejected'].includes(refreshOutcome.status))
    assert.equal(await prisma.refreshToken.count({ where: { userId: fixture.user.id, revokedAt: null } }), 0)
    await assert.rejects(refreshService.refresh({ refreshToken: initial.rawToken }))
  }))

test('failed replacement token creation rolls back the refresh claim', () =>
  fixtureTest({}, async (fixture) => {
    const initial = await createRefreshToken(fixture)
    const transactionProxy = {
      $transaction: (callback, options) => prisma.$transaction((tx) => callback(new Proxy(tx, {
        get(target, property) {
          const value = Reflect.get(target, property, target)
          if (property !== 'refreshToken') return value
          return new Proxy(value, {
            get(delegate, operation) {
              if (operation === 'create') return async () => { throw new Error('injected create failure') }
              const method = Reflect.get(delegate, operation, delegate)
              return typeof method === 'function' ? method.bind(delegate) : method
            },
          })
        },
      })), options),
      refreshToken: prisma.refreshToken,
    }
    await assert.rejects(makeRefreshService(transactionProxy).refresh({ refreshToken: initial.rawToken }), /injected create failure/)
    const stored = await prisma.refreshToken.findUnique({ where: { id: initial.token.id } })
    assert.equal(stored.revokedAt, null)
    assert.equal(stored.replacedBy, null)
    assert.equal(await prisma.refreshToken.count({ where: { userId: fixture.user.id } }), 1)
  }))

test('conventional login, logout and authorized PIN login preserve device authorization', () =>
  fixtureTest({}, async (fixture) => {
    const password = 'integration-only-password'
    const pin = '123456'
    await prisma.user.update({
      where: { id: fixture.user.id },
      data: { password: await bcrypt.hash(password, 4), quickPinHash: await bcrypt.hash(pin, 4) },
    })
    const rawDeviceToken = randomUUID().replaceAll('-', '')
    await prisma.quickPinDevice.create({
      data: {
        userId: fixture.user.id,
        tokenHash: hashToken(rawDeviceToken),
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const tokenService = new TokenService({ sign: () => 'integration-access-token' }, prisma)
    const conventionalLogin = new LoginService(new UserService(prisma), tokenService)
    const session = await conventionalLogin.login({ email: fixture.user.email, password, isRemember: false })
    assert.ok(session.accessToken)
    assert.ok(session.refreshToken)
    const logout = new LogoutService(prisma)
    await logout.logout({ refreshToken: session.refreshToken })

    const quickPin = new QuickPinService(prisma, tokenService)
    assert.deepEqual(await quickPin.deviceStatus(rawDeviceToken), { enabled: true, userName: fixture.user.name })
    const pinSession = await quickPin.login(rawDeviceToken, { pin })
    assert.ok(pinSession.accessToken)
    assert.ok(pinSession.refreshToken)
    assert.equal(await prisma.refreshToken.count({ where: { tokenHash: hashToken(pinSession.refreshToken), revokedAt: null } }), 1)
    assert.equal(await prisma.quickPinDevice.count({ where: { userId: fixture.user.id, revokedAt: null } }), 1)
  }))

function itemsFor(products, quantity = 1) {
  return products.map((product) => ({
    productId: product.id,
    quantity,
    unitPrice: 100,
    priceType: PriceType.PUBLIC,
  }))
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

async function holdProductRowLock(fixture, product = fixture.products[0]) {
  const acquired = deferred()
  const release = deferred()
  const transaction = prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      UPDATE "products"
      SET "updatedAt" = "updatedAt"
      WHERE "id" = ${product.id} AND "tenantId" = ${fixture.tenant.id}
      RETURNING "id"
    `
    assert.equal(rows.length, 1)
    acquired.resolve()
    await release.promise
  })
  await acquired.promise
  return { release: release.resolve, transaction }
}

async function waitForProductLockWaits(expectedCount, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  let observed = 0
  while (Date.now() < deadline) {
    const rows = await prisma.$queryRaw`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'active'
        AND wait_event_type = 'Lock'
        AND query ILIKE '%UPDATE "products"%'
    `
    observed = Number(rows[0]?.count ?? 0)
    if (observed >= expectedCount) return observed
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Expected ${expectedCount} overlapping product updates; observed ${observed} lock waiters`)
}

async function holdIdempotencyKey(fixture, operation, key) {
  const acquired = deferred()
  const release = deferred()
  const transaction = prisma.$transaction(async (tx) => {
    await tx.idempotencyRecord.create({
      data: {
        tenantId: fixture.tenant.id,
        operation,
        key,
        requestHash: '0'.repeat(64),
      },
    })
    acquired.resolve()
    await release.promise
    throw new Error('rollback test idempotency lock')
  }).catch((error) => {
    if (error.message !== 'rollback test idempotency lock') throw error
  })
  await acquired.promise
  return { release: release.resolve, transaction }
}

async function waitForIdempotencyLockWaits(expectedCount, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  let observed = 0
  while (Date.now() < deadline) {
    const rows = await prisma.$queryRaw`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'active'
        AND wait_event_type = 'Lock'
        AND query ILIKE '%idempotency_records%'
    `
    observed = Number(rows[0]?.count ?? 0)
    if (observed >= expectedCount) return observed
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Expected ${expectedCount} overlapping idempotency inserts; observed ${observed} lock waiters`)
}

async function holdUserRowLock(fixture) {
  const acquired = deferred()
  const release = deferred()
  const transaction = prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      UPDATE "users"
      SET "updatedAt" = "updatedAt"
      WHERE "id" = ${fixture.user.id}
      RETURNING "id"
    `
    assert.equal(rows.length, 1)
    acquired.resolve()
    await release.promise
  })
  await acquired.promise
  return { release: release.resolve, transaction }
}

async function waitForRefreshUserLockWaits(expectedCount, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  let observed = 0
  while (Date.now() < deadline) {
    const rows = await prisma.$queryRaw`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'active'
        AND wait_event_type = 'Lock'
        AND query ILIKE '%FOR UPDATE%'
        AND query ILIKE '%"users"%'
    `
    observed = Number(rows[0]?.count ?? 0)
    if (observed >= expectedCount) return observed
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`Expected ${expectedCount} overlapping refresh/logout requests; observed ${observed} lock waiters`)
}

async function createRefreshToken(fixture, { rawToken = randomUUID().replaceAll('-', ''), expiresAt = new Date(Date.now() + 60_000), revokedAt = null } = {}) {
  const tokenHash = hashToken(rawToken)
  const token = await prisma.refreshToken.create({
    data: { userId: fixture.user.id, tokenHash, expiresAt, revokedAt },
  })
  return { rawToken, tokenHash, token }
}

function makeRefreshService(prismaClient = prisma) {
  return new RefreshTokenService(prismaClient, { signAccessToken: (_user, token) => `access:${hashToken(token)}` })
}

async function createPurchaseSupplier(fixture) {
  return prisma.supplier.create({
    data: { tenantId: fixture.tenant.id, name: `Concurrency supplier ${randomUUID()}` },
  })
}

function purchaseDto(fixture, supplier, product, quantity, paymentType = 'CASH') {
  const invoiceSequence = String(Math.floor(Math.random() * 9_999_999) + 1).padStart(7, '0')
  const unitCost = 20
  return {
    supplierId: supplier.id,
    invoiceNumber: `001-001-${invoiceSequence}`,
    purchaseDate: new Date().toISOString(),
    paymentType,
    total: quantity * unitCost,
    ...(paymentType === 'CREDIT' && {
      debt: { scheduleType: 'NONE', dueDate: new Date(Date.now() + 86_400_000).toISOString() },
    }),
    items: [{ productId: product.id, quantity, unitCost }],
  }
}

async function createSecondOpenSession(fixture) {
  return prisma.cashSession.create({
    data: { tenantId: fixture.tenant.id, openedBy: fixture.user.id, openingAmount: 0 },
  })
}

async function cashTotals(fixture) {
  return new CashSessionService(prisma).calculateTotals(fixture.tenant.id, fixture.cashSession.id)
}

test('concurrent cash openings create only one active session per tenant', () =>
  fixtureTest({ openSession: false }, async (f) => {
    const cash = new CashSessionService(prisma)
    const outcomes = await Promise.allSettled([
      cash.open(f.tenant.id, f.user.id, { openingAmount: 100 }),
      cash.open(f.tenant.id, f.user.id, { openingAmount: 200 }),
    ])
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1)
    assert.equal(await prisma.cashSession.count({ where: { tenantId: f.tenant.id, status: 'OPEN' } }), 1)
  }))

test('opening returns complete expected cash immediately and a reopened session does not inherit old pending payments', () =>
  fixtureTest({ openSession: false }, async (f) => {
    const cash = new CashSessionService(prisma)
    const historicalOpenedAt = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const historicalClosedAt = new Date(Date.now() - 60 * 60 * 1000)
    await prisma.cashSession.create({
      data: {
        tenantId: f.tenant.id,
        openedBy: f.user.id,
        openingAmount: 500,
        status: 'CLOSED',
        openedAt: historicalOpenedAt,
        closedAt: historicalClosedAt,
        expectedAmount: 500,
        closingAmount: 500,
      },
    })
    await prisma.customerPayment.create({
      data: {
        tenantId: f.tenant.id,
        customerId: f.customer.id,
        amount: 25,
        paymentMethod: PaymentMethod.CREDIT,
        paymentDate: new Date(historicalOpenedAt.getTime() + 30 * 60 * 1000),
      },
    })

    const first = await cash.open(f.tenant.id, f.user.id, { openingAmount: 73_000_000 })
    assert.equal(Number(first.expectedCashAmount), 73_000_000)
    assert.equal(first.cashReconciliationRequired, false)
    assert.equal(Number(first.unclassifiedCustomerPayments), 0)

    const closed = await cash.close(f.tenant.id, first.id, { closingAmount: 73_000_000 })
    assert.equal(Number(closed.expectedAmount), 73_000_000)
    const closedHistoryRow = await prisma.cashSession.findUnique({ where: { id: first.id } })
    assert.equal(Number(closedHistoryRow.openingAmount), 73_000_000)
    assert.equal(Number(closedHistoryRow.expectedAmount), 73_000_000)
    assert.equal(Number(closedHistoryRow.closingAmount), 73_000_000)
    assert.equal(Number(closedHistoryRow.difference), 0)
    assert.equal(closedHistoryRow.status, 'CLOSED')
    assert.ok(closedHistoryRow.closedAt)
    assert.equal(closedHistoryRow.openedBy, f.user.id)

    const reopened = await cash.open(f.tenant.id, f.user.id, { openingAmount: 0 })
    assert.equal(Number(reopened.expectedCashAmount), 0)
    assert.equal(reopened.cashReconciliationRequired, false)
    assert.equal(Number(reopened.unclassifiedCustomerPayments), 0)

    const refreshed = (await cash.getCurrent(f.tenant.id)).session
    assert.equal(Number(refreshed.expectedCashAmount), 0)
    assert.equal(refreshed.cashReconciliationRequired, false)
    const finalClose = await cash.close(f.tenant.id, reopened.id, { closingAmount: 0 })
    assert.equal(Number(finalClose.expectedAmount), 0)
  }))

test('CASH with customer is paid, has no debt/payment ledger entry, and agrees with cash totals', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    const sale = await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      customerId: f.customer.id,
      items: itemsFor(f.products),
    })
    const [customer, session, paymentCount] = await Promise.all([
      prisma.customer.findUnique({ where: { id: f.customer.id } }),
      prisma.cashSession.findUnique({ where: { id: f.cashSession.id } }),
      prisma.customerPayment.count({ where: { saleId: sale.id } }),
    ])
    const totals = await cashTotals(f)
    assert.equal(sale.paymentStatus, PaymentStatus.PAID)
    assert.equal(Number(sale.remainingBalance), 0)
    assert.equal(Number(customer.currentDebt), 0)
    assert.equal(paymentCount, 0)
    assert.equal(Number(session.totalSales), 100)
    assert.equal(totals.totalSales, 100)
    assert.equal(Number(totals.totalDebtPayments), 0)
  }))

test('CASH without customer is paid and counted once', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    const sale = await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      items: itemsFor(f.products),
    })
    const totals = await cashTotals(f)
    assert.equal(sale.customerId, null)
    assert.equal(sale.paymentStatus, PaymentStatus.PAID)
    assert.equal(Number(sale.remainingBalance), 0)
    assert.equal(totals.totalSales, 100)
  }))

for (const method of [PaymentMethod.CARD, PaymentMethod.TRANSFER]) {
  test(`${method} is paid and included once in current cash-session reporting`, () =>
    fixtureTest({}, async (f) => {
      const { service } = makeSaleService()
      const sale = await service.create(f.tenant.id, f.cashSession.id, {
        paymentMethod: method,
        customerId: f.customer.id,
        items: itemsFor(f.products),
      })
      const totals = await cashTotals(f)
      assert.equal(sale.paymentStatus, PaymentStatus.PAID)
      assert.equal(Number(sale.remainingBalance), 0)
      assert.equal(totals.totalSales, 100)
      assert.equal(Number(totals.totalDebtPayments), 0)
      assert.equal(totals.totalElectronicSales, 100)
      assert.equal(totals.expectedCashAmount, 0)
      assert.equal(await prisma.customerPayment.count({ where: { saleId: sale.id } }), 0)
    }))
}

test('CREDIT pending adds debt but no payment or drawer inflow', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    const sale = await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      items: itemsFor(f.products, 2),
    })
    const [customer, session, totals] = await Promise.all([
      prisma.customer.findUnique({ where: { id: f.customer.id } }),
      prisma.cashSession.findUnique({ where: { id: f.cashSession.id } }),
      cashTotals(f),
    ])
    assert.equal(sale.paymentStatus, PaymentStatus.PENDING)
    assert.equal(Number(sale.remainingBalance), 200)
    assert.equal(Number(customer.currentDebt), 200)
    assert.equal(await prisma.customerPayment.count({ where: { saleId: sale.id } }), 0)
    assert.equal(Number(session.totalSales), 0)
    assert.equal(totals.totalSales, 0)
    assert.equal(Number(totals.totalCreditSales), 200)
  }))

test('CREDIT partial records only the collected part in cash and payment ledger', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    const sale = await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      amountPaid: 50,
      initialPaymentMethod: PaymentMethod.CASH,
      items: itemsFor(f.products, 2),
    })
    const [customer, session, payment, totals] = await Promise.all([
      prisma.customer.findUnique({ where: { id: f.customer.id } }),
      prisma.cashSession.findUnique({ where: { id: f.cashSession.id } }),
      prisma.customerPayment.findFirst({ where: { saleId: sale.id } }),
      cashTotals(f),
    ])
    assert.equal(sale.paymentStatus, PaymentStatus.PARTIAL)
    assert.equal(Number(sale.remainingBalance), 150)
    assert.equal(Number(customer.currentDebt), 150)
    assert.equal(Number(payment.amount), 50)
    assert.equal(payment.paymentMethod, PaymentMethod.CASH)
    assert.equal(Number(session.totalSales), 50)
    assert.equal(totals.totalSales, 50)
    assert.equal(Number(totals.totalCreditSales), 150)
    assert.equal(totals.totalCashDebtPayments, 50)
    assert.equal(totals.expectedCashAmount, 50)
  }))

test('CREDIT initial transfer deposit is reported commercially but excluded from physical cash', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    const sale = await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      amountPaid: 30,
      initialPaymentMethod: PaymentMethod.TRANSFER,
      items: itemsFor(f.products, 2),
    })
    const payment = await prisma.customerPayment.findFirst({ where: { saleId: sale.id } })
    const totals = await cashTotals(f)
    assert.equal(payment.paymentMethod, PaymentMethod.TRANSFER)
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 170)
    assert.equal(totals.totalDebtPayments, 30)
    assert.equal(totals.totalElectronicDebtPayments, 30)
    assert.equal(totals.totalCashDebtPayments, 0)
    assert.equal(totals.expectedCashAmount, 0)
  }))

for (const method of [PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER]) {
  test(`later customer debt payment by ${method} affects physical cash only when CASH`, () =>
    fixtureTest({}, async (f) => {
      const { service } = makeSaleService()
      await service.create(f.tenant.id, f.cashSession.id, {
        paymentMethod: PaymentMethod.CREDIT,
        customerId: f.customer.id,
        items: itemsFor(f.products),
      })
      await makeCustomerPaymentService().payToAccount(f.tenant.id, {
        customerId: f.customer.id,
        amount: 20,
        paymentMethod: method,
      })
      const totals = await cashTotals(f)
      assert.equal(totals.totalDebtPayments, 20)
      assert.equal(totals.totalCashDebtPayments, method === PaymentMethod.CASH ? 20 : 0)
      assert.equal(totals.totalElectronicDebtPayments, method === PaymentMethod.CASH ? 0 : 20)
      assert.equal(totals.expectedCashAmount, method === PaymentMethod.CASH ? 20 : 0)
    }))
}

test('mixed cash and transfer customer receipts preserve gross totals and physical drawer balance', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      amountPaid: 25,
      initialPaymentMethod: PaymentMethod.TRANSFER,
      items: itemsFor(f.products, 2),
    })
    const payments = makeCustomerPaymentService()
    await payments.payToAccount(f.tenant.id, {
      customerId: f.customer.id,
      amount: 20,
      paymentMethod: PaymentMethod.CASH,
    })
    await payments.payToAccount(f.tenant.id, {
      customerId: f.customer.id,
      amount: 30,
      paymentMethod: PaymentMethod.TRANSFER,
    })
    const totals = await cashTotals(f)
    assert.equal(totals.totalDebtPayments, 75)
    assert.equal(totals.totalCashDebtPayments, 20)
    assert.equal(totals.totalElectronicDebtPayments, 55)
    assert.equal(totals.expectedCashAmount, 20)
  }))

test('opening and manual movements are included in exact physical cash close', () =>
  fixtureTest({ openSession: false }, async (f) => {
    const cash = new CashSessionService(prisma)
    const opened = await cash.open(f.tenant.id, f.user.id, { openingAmount: 100 })
    f.cashSession = opened
    await cash.addMovement(f.tenant.id, { amount: 20, type: 'IN', description: 'Fixture cash in' })
    await cash.addMovement(f.tenant.id, { amount: 10, type: 'OUT', description: 'Fixture cash out' })
    const exact = await cash.close(f.tenant.id, opened.id, { closingAmount: 110 })
    assert.equal(Number(exact.expectedAmount), 110)
    assert.equal(Number(exact.difference), 0)
  }))

test('manual cash movements are rejected after the session closes', () =>
  fixtureTest({}, async (f) => {
    const cash = new CashSessionService(prisma)
    await cash.close(f.tenant.id, f.cashSession.id, { closingAmount: 0 })
    await assert.rejects(
      cash.addMovement(f.tenant.id, { amount: 10, type: 'IN', description: 'Must not reach a closed session' }),
      (error) => error.getStatus?.() === 400 || error.getStatus?.() === 409,
    )
    assert.equal(await prisma.cashMovement.count({ where: { cashSessionId: f.cashSession.id } }), 0)
  }))

test('concurrent manual movement and cash close either include the movement or reject it', () =>
  fixtureTest({}, async (f) => {
    const cash = new CashSessionService(prisma)
    const [movement, closed] = await Promise.allSettled([
      cash.addMovement(f.tenant.id, { amount: 10, type: 'IN', description: 'Concurrent close test' }),
      cash.close(f.tenant.id, f.cashSession.id, { closingAmount: 10 }),
    ])
    assert.equal(closed.status, 'fulfilled')
    const movementCount = await prisma.cashMovement.count({ where: { cashSessionId: f.cashSession.id } })
    if (movement.status === 'fulfilled') {
      assert.equal(movementCount, 1)
      assert.equal(Number(closed.value.expectedAmount), 10)
    } else {
      assert.equal(movementCount, 0)
      assert.equal(Number(closed.value.expectedAmount), 0)
    }
  }))

test('purchase registration is rejected for a closed or foreign cash session', () =>
  fixtureTest({}, async (f) => {
    const supplier = await prisma.supplier.create({
      data: { tenantId: f.tenant.id, name: `Supplier ${randomUUID()}` },
    })
    const stock = new StockMovementService(prisma)
    const products = new ProductService(prisma, stock)
    const validation = new PurchaseValidationService(prisma, products)
    const purchases = new PurchaseService(prisma, stock, validation, new PurchaseDebtService(prisma))
    await new CashSessionService(prisma).close(f.tenant.id, f.cashSession.id, { closingAmount: 0 })
    await assert.rejects(
      purchases.create(f.tenant.id, f.cashSession.id, {
        supplierId: supplier.id,
        invoiceNumber: '001-001-0000001',
        purchaseDate: new Date().toISOString(),
        paymentType: 'CASH',
        total: 25,
        items: [{ productId: f.products[0].id, quantity: 1, unitCost: 25 }],
      }),
      (error) => error.getStatus?.() === 409,
    )
    assert.equal(await prisma.purchase.count({ where: { tenantId: f.tenant.id } }), 0)
  }))

test('cash and credit purchases preserve stock and credit accounting', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const supplier = await createPurchaseSupplier(f)
    const purchases = makePurchaseService()
    const cashPurchase = await purchases.create(
      f.tenant.id,
      f.cashSession.id,
      purchaseDto(f, supplier, f.products[0], 2, 'CASH'),
    )
    const creditPurchase = await purchases.create(
      f.tenant.id,
      f.cashSession.id,
      purchaseDto(f, supplier, f.products[0], 3, 'CREDIT'),
    )

    assert.equal(cashPurchase.status, 'RECEIVED')
    assert.equal(cashPurchase.debt, null)
    assert.equal(creditPurchase.status, 'RECEIVED')
    assert.equal(Number(creditPurchase.debt.balance), 60)
    assert.equal((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock, 15)
    const movements = await prisma.stockMovement.findMany({
      where: { tenantId: f.tenant.id, productId: f.products[0].id },
      orderBy: { before: 'asc' },
    })
    assert.deepEqual(movements.map(({ before, after }) => [before, after]), [[10, 12], [12, 15]])
  }))

test('two overlapping purchases of the same product both increment stock and chain movement values', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const supplier = await createPurchaseSupplier(f)
    const secondSession = await createSecondOpenSession(f)
    const purchases = makePurchaseService()
    const heldLock = await holdProductRowLock(f)
    const outcomesPromise = Promise.allSettled([
      purchases.create(f.tenant.id, f.cashSession.id, purchaseDto(f, supplier, f.products[0], 2)),
      purchases.create(f.tenant.id, secondSession.id, purchaseDto(f, supplier, f.products[0], 5)),
    ])

    try {
      assert.ok(await waitForProductLockWaits(2) >= 2, 'both transactions must wait on the product row')
    } finally {
      heldLock.release()
    }
    await heldLock.transaction
    const outcomes = await outcomesPromise
    assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 2)
    assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 0)
    assert.equal((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock, 17)
    const movements = await prisma.stockMovement.findMany({
      where: { tenantId: f.tenant.id, productId: f.products[0].id },
    })
    const firstMovement = movements.find(({ before }) => before === 10)
    assert.ok(firstMovement)
    const secondMovement = movements.find(({ before }) => before === firstMovement.after)
    assert.ok(secondMovement)
    assert.equal(secondMovement.after, 17)
    assert.deepEqual([firstMovement.after - firstMovement.before, secondMovement.after - secondMovement.before].sort((a, b) => a - b), [2, 5])
  }))

test('overlapping purchase and sale preserve the final stock and before/after chain', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const supplier = await createPurchaseSupplier(f)
    const secondSession = await createSecondOpenSession(f)
    const purchases = makePurchaseService()
    const { service: sales } = makeSaleService()
    const heldLock = await holdProductRowLock(f)
    const outcomesPromise = Promise.allSettled([
      purchases.create(f.tenant.id, f.cashSession.id, purchaseDto(f, supplier, f.products[0], 5)),
      sales.create(f.tenant.id, secondSession.id, {
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: f.products[0].id, quantity: 3, unitPrice: 100, priceType: PriceType.PUBLIC }],
      }),
    ])

    try {
      assert.ok(await waitForProductLockWaits(2) >= 2, 'purchase and sale must overlap at the product row')
    } finally {
      heldLock.release()
    }
    await heldLock.transaction
    const outcomes = await outcomesPromise
    assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 2)
    assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 0)
    const finalStock = (await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock
    assert.equal(finalStock, 12)
    const movements = await prisma.stockMovement.findMany({
      where: { tenantId: f.tenant.id, productId: f.products[0].id },
    })
    assert.equal(movements.length, 2)
    let current = 10
    const remaining = [...movements]
    while (remaining.length) {
      const index = remaining.findIndex((movement) => movement.before === current)
      assert.notEqual(index, -1, `no movement continues stock from ${current}`)
      current = remaining.splice(index, 1)[0].after
    }
    assert.equal(current, finalStock)
  }))

test('purchase stock update rejects products owned by another tenant', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const foreign = await createFixture({ stock: 9 })
    try {
      const stock = new StockMovementService(prisma)
      await assert.rejects(
        prisma.$transaction((tx) => stock.registerPurchase(
          f.tenant.id,
          foreign.products[0].id,
          2,
          randomUUID(),
          tx,
        )),
        (error) => error.getStatus?.() === 404,
      )
      assert.equal((await prisma.product.findUnique({ where: { id: foreign.products[0].id } })).stock, 9)
      assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 0)
    } finally {
      await cleanupFixture(foreign)
    }
  }))

test('purchase failure after stock update rolls back purchase, movement and inventory', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const supplier = await createPurchaseSupplier(f)
    const stock = new StockMovementService(prisma)
    const registerPurchase = stock.registerPurchase.bind(stock)
    stock.registerPurchase = async (...args) => {
      await registerPurchase(...args)
      throw new Error('injected after purchase stock movement')
    }
    const purchases = makePurchaseService(stock)

    await assert.rejects(
      purchases.create(f.tenant.id, f.cashSession.id, purchaseDto(f, supplier, f.products[0], 4)),
      /injected after purchase stock movement/,
    )
    assert.equal(await prisma.purchase.count({ where: { tenantId: f.tenant.id } }), 0)
    assert.equal(await prisma.purchaseItem.count({ where: { purchase: { tenantId: f.tenant.id } } }), 0)
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 0)
    assert.equal((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock, 10)
  }))

for (const [label, counted, expectedDifference] of [['surplus', 110, 10], ['shortage', 90, -10]]) {
  test(`cash close records a ${label} from the physical count`, () =>
    fixtureTest({ openingAmount: 100 }, async (f) => {
      const closed = await new CashSessionService(prisma).close(
        f.tenant.id,
        f.cashSession.id,
        { closingAmount: counted },
      )
      assert.equal(Number(closed.expectedAmount), 100)
      assert.equal(Number(closed.difference), expectedDifference)
    }))
}

test('unclassified legacy customer payments prevent closing without modifying history', () =>
  fixtureTest({}, async (f) => {
    await prisma.customerPayment.create({
      data: {
        tenantId: f.tenant.id,
        customerId: f.customer.id,
        amount: 15,
        paymentMethod: PaymentMethod.CREDIT,
      },
    })
    const cash = new CashSessionService(prisma)
    await assert.rejects(
      cash.close(f.tenant.id, f.cashSession.id, { closingAmount: 0 }),
      (error) => error.getStatus?.() === 409,
    )
    assert.equal(await prisma.customerPayment.count({ where: { tenantId: f.tenant.id, paymentMethod: PaymentMethod.CREDIT } }), 1)
    assert.equal((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).status, 'OPEN')
  }))

for (const method of [PaymentMethod.CASH, PaymentMethod.TRANSFER, PaymentMethod.CARD]) {
  test(`customer reconciliation classifies an existing payment as ${method} without touching debt or amount`, () =>
    fixtureTest({ openingAmount: 100 }, async (f) => {
      const payment = await prisma.customerPayment.create({
        data: {
          tenantId: f.tenant.id,
          customerId: f.customer.id,
          amount: 40,
          paymentMethod: PaymentMethod.CREDIT,
          paymentDate: new Date(),
        },
      })
      const cash = new CashSessionService(prisma)
      const pending = await cash.getReconciliationItems(f.tenant.id)
      assert.equal(pending.customers.length, 1)
      assert.equal(pending.customers[0].canClassify, true)
      await cash.classifyPayment(f.tenant.id, f.user.id, 'CUSTOMER', payment.id, {
        paymentMethod: method,
        reason: 'Comprobante verificado en integración',
      })
      const saved = await prisma.customerPayment.findUnique({ where: { id: payment.id } })
      assert.equal(saved.paymentMethod, method)
      assert.equal(saved.cashSessionId, f.cashSession.id)
      assert.equal(Number(saved.amount), 40)
      assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 0)
      assert.equal(await prisma.cashPaymentClassificationAudit.count({ where: { customerPaymentId: payment.id } }), 1)
      const totals = await cashTotals(f)
      assert.equal(totals.unclassifiedCustomerPayments, 0)
      assert.equal(totals.expectedCashAmount, method === PaymentMethod.CASH ? 140 : 100)
    }))
}

for (const method of [PaymentMethod.CASH, PaymentMethod.TRANSFER]) {
  test(`supplier reconciliation classifies an existing payment as ${method} without touching debt`, () =>
    fixtureTest({ openingAmount: 100 }, async (f) => {
      const { supplier, debt } = await createSupplierDebt(f)
      const payment = await prisma.purchaseDebtPayment.create({
        data: {
          tenantId: f.tenant.id,
          purchaseDebtId: debt.id,
          amount: 25,
          paymentDate: new Date(),
          paymentMethod: null,
        },
      })
      const cash = new CashSessionService(prisma)
      const pending = await cash.getReconciliationItems(f.tenant.id)
      assert.equal(pending.suppliers.length, 1)
      assert.equal(pending.suppliers[0].supplier.id, supplier.id)
      assert.equal(pending.suppliers[0].canClassify, true)
      await cash.classifyPayment(f.tenant.id, f.user.id, 'SUPPLIER', payment.id, {
        paymentMethod: method,
        reason: 'Comprobante verificado en integración',
      })
      const saved = await prisma.purchaseDebtPayment.findUnique({ where: { id: payment.id } })
      assert.equal(saved.paymentMethod, method)
      assert.equal(saved.cashSessionId, f.cashSession.id)
      assert.equal(Number(saved.amount), 25)
      assert.equal(Number((await prisma.purchaseDebt.findUnique({ where: { id: debt.id } })).balance), 100)
      assert.equal(await prisma.cashPaymentClassificationAudit.count({ where: { supplierPaymentId: payment.id } }), 1)
      const totals = await cashTotals(f)
      assert.equal(totals.unclassifiedSupplierPayments, 0)
      assert.equal(totals.expectedCashAmount, method === PaymentMethod.CASH ? 75 : 100)
    }))
}

test('overlapping historical customer payment sessions are non-classifiable', () =>
  fixtureTest({}, async (f) => {
    const paymentDate = new Date()
    await prisma.cashSession.update({
      where: { id: f.cashSession.id },
      data: { openedAt: paymentDate },
    })
    const overlap = await prisma.cashSession.create({
      data: {
        tenantId: f.tenant.id,
        openedBy: f.user.id,
        openingAmount: 0,
        status: 'CLOSED',
        openedAt: new Date(paymentDate.getTime() - 60_000),
        closedAt: paymentDate,
      },
    })
    const payment = await prisma.customerPayment.create({
      data: {
        tenantId: f.tenant.id,
        customerId: f.customer.id,
        amount: 10,
        paymentMethod: PaymentMethod.CREDIT,
        paymentDate,
      },
    })
    const cash = new CashSessionService(prisma)
    const pending = await cash.getReconciliationItems(f.tenant.id)
    assert.equal(pending.customers[0].canClassify, false)
    assert.equal((await cashTotals(f)).unclassifiedCustomerPayments, 10)
    await assert.rejects(
      cash.classifyPayment(f.tenant.id, f.user.id, 'CUSTOMER', payment.id, {
        paymentMethod: PaymentMethod.CASH,
        reason: 'Comprobante ambiguo',
      }),
      (error) => error.getStatus?.() === 409,
    )
    await prisma.cashSession.delete({ where: { id: overlap.id } })
  }))

test('closed session reports retain the historical inclusive closedAt calculation', () =>
  fixtureTest({}, async (f) => {
    const closedAt = new Date()
    await prisma.cashSession.update({
      where: { id: f.cashSession.id },
      data: { status: 'CLOSED', closedAt, expectedAmount: 0 },
    })
    await prisma.customerPayment.create({
      data: {
        tenantId: f.tenant.id,
        customerId: f.customer.id,
        amount: 22,
        paymentMethod: PaymentMethod.CREDIT,
        paymentDate: closedAt,
      },
    })
    const report = await new CashSessionService(prisma).getReport(f.tenant.id, f.cashSession.id)
    assert.equal(Number(report.totals.totalDebtPayments), 22)
    assert.equal(Number(report.totals.unclassifiedCustomerPayments), 22)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).expectedAmount), 0)
  }))

test('classification is tenant-scoped and cannot modify a closed cash session', () =>
  fixtureTest({}, async (f) => {
    const foreign = await createFixture()
    try {
      const payment = await prisma.customerPayment.create({
        data: {
          tenantId: f.tenant.id,
          customerId: f.customer.id,
          amount: 10,
          paymentMethod: PaymentMethod.CREDIT,
          paymentDate: new Date(),
        },
      })
      const cash = new CashSessionService(prisma)
      await assert.rejects(
        cash.classifyPayment(foreign.tenant.id, foreign.user.id, 'CUSTOMER', payment.id, {
          paymentMethod: PaymentMethod.CASH,
          reason: 'Debe estar aislado',
        }),
        (error) => error.getStatus?.() === 404,
      )
      await prisma.cashSession.update({
        where: { id: f.cashSession.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
      const reportBefore = await cash.getReport(f.tenant.id, f.cashSession.id)
      await assert.rejects(
        cash.classifyPayment(f.tenant.id, f.user.id, 'CUSTOMER', payment.id, {
          paymentMethod: PaymentMethod.CASH,
          reason: 'Caja cerrada',
        }),
        (error) => error.getStatus?.() === 409,
      )
      const reportAfter = await cash.getReport(f.tenant.id, f.cashSession.id)
      assert.deepEqual(reportAfter.totals, reportBefore.totals)
      assert.equal((await prisma.customerPayment.findUnique({ where: { id: payment.id } })).paymentMethod, PaymentMethod.CREDIT)
    } finally {
      await cleanupFixture(foreign)
    }
  }))

test('two concurrent classifications of one payment create exactly one audit row', () =>
  fixtureTest({}, async (f) => {
    const payment = await prisma.customerPayment.create({
      data: {
        tenantId: f.tenant.id,
        customerId: f.customer.id,
        amount: 10,
        paymentMethod: PaymentMethod.CREDIT,
        paymentDate: new Date(),
      },
    })
    const cash = new CashSessionService(prisma)
    const attempts = await Promise.allSettled([
      cash.classifyPayment(f.tenant.id, f.user.id, 'CUSTOMER', payment.id, { paymentMethod: PaymentMethod.CASH, reason: 'Comprobante A' }),
      cash.classifyPayment(f.tenant.id, f.user.id, 'CUSTOMER', payment.id, { paymentMethod: PaymentMethod.TRANSFER, reason: 'Comprobante B' }),
    ])
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1)
    assert.equal(await prisma.cashPaymentClassificationAudit.count({ where: { customerPaymentId: payment.id } }), 1)
  }))

test('reconciliation and close serialize without preserving an incorrect drawer total', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const payment = await prisma.customerPayment.create({
      data: {
        tenantId: f.tenant.id,
        customerId: f.customer.id,
        amount: 20,
        paymentMethod: PaymentMethod.CREDIT,
        paymentDate: new Date(),
      },
    })
    const cash = new CashSessionService(prisma)
    const [classification] = await Promise.allSettled([
      cash.classifyPayment(f.tenant.id, f.user.id, 'CUSTOMER', payment.id, {
        paymentMethod: PaymentMethod.CASH,
        reason: 'Concurrent close test',
      }),
      cash.close(f.tenant.id, f.cashSession.id, { closingAmount: 120 }),
    ])
    assert.equal(classification.status, 'fulfilled')
    const session = await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })
    if (session.status === 'OPEN') {
      await cash.close(f.tenant.id, f.cashSession.id, { closingAmount: 120 })
    }
    const finalSession = await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })
    assert.equal(finalSession.status, 'CLOSED')
    assert.equal(Number(finalSession.expectedAmount), 120)
    assert.equal((await prisma.customerPayment.findUnique({ where: { id: payment.id } })).paymentMethod, PaymentMethod.CASH)
  }))

test('audit insertion failure rolls back a payment reclassification in PostgreSQL', () =>
  fixtureTest({}, async (f) => {
    const payment = await prisma.customerPayment.create({
      data: {
        tenantId: f.tenant.id,
        customerId: f.customer.id,
        amount: 18,
        paymentMethod: PaymentMethod.CREDIT,
        paymentDate: new Date(),
      },
    })
    const originalTransaction = prisma.$transaction.bind(prisma)
    prisma.$transaction = (callback, options) => originalTransaction((tx) => callback(new Proxy(tx, {
      get(target, property, receiver) {
        if (property !== 'cashPaymentClassificationAudit') return Reflect.get(target, property, receiver)
        const delegate = Reflect.get(target, property, target)
        return new Proxy(delegate, {
          get(auditTarget, operation, auditReceiver) {
            if (operation === 'create') return async () => { throw new Error('intentional audit failure') }
            return Reflect.get(auditTarget, operation, auditReceiver)
          },
        })
      },
    })), options)
    try {
      const cash = new CashSessionService(prisma)
      await assert.rejects(cash.classifyPayment(f.tenant.id, f.user.id, 'CUSTOMER', payment.id, {
        paymentMethod: PaymentMethod.CASH,
        reason: 'Rollback test',
      }), /intentional audit failure/)
      assert.equal((await prisma.customerPayment.findUnique({ where: { id: payment.id } })).paymentMethod, PaymentMethod.CREDIT)
      assert.equal(await prisma.cashPaymentClassificationAudit.count({ where: { customerPaymentId: payment.id } }), 0)
    } finally {
      prisma.$transaction = originalTransaction
    }
  }))

test('supplier debt payments are surfaced as unclassified and block an unsafe physical cash close', () =>
  fixtureTest({}, async (f) => {
    const supplier = await prisma.supplier.create({
      data: { tenantId: f.tenant.id, name: `Supplier ${randomUUID()}` },
    })
    const purchase = await prisma.purchase.create({
      data: {
        tenantId: f.tenant.id,
        supplierId: supplier.id,
        invoiceNumber: `invoice-${randomUUID()}`,
        purchaseDate: new Date(),
        paymentType: 'CREDIT',
        total: 100,
        cashSessionId: f.cashSession.id,
      },
    })
    const debt = await prisma.purchaseDebt.create({
      data: {
        tenantId: f.tenant.id,
        purchaseId: purchase.id,
        totalAmount: 100,
        balance: 100,
      },
    })
    await prisma.purchaseDebtPayment.create({
      data: {
        tenantId: f.tenant.id,
        purchaseDebtId: debt.id,
        cashSessionId: f.cashSession.id,
        amount: 25,
        paymentDate: new Date('2020-01-01T00:00:00.000Z'),
      },
    })
    const totals = await cashTotals(f)
    assert.equal(totals.totalPurchaseDebtPayments, 25)
    assert.equal(totals.unclassifiedSupplierPayments, 25)
    assert.equal(totals.expectedCashAmount, null)
    await assert.rejects(
      new CashSessionService(prisma).close(f.tenant.id, f.cashSession.id, { closingAmount: 0 }),
      (error) => error.getStatus?.() === 409,
    )
    assert.equal((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).status, 'OPEN')
  }))

test('supplier payment cashSessionId is validated against tenant and open status', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const payments = new PurchaseDebtService(prisma)
    const created = await payments.registerPayment(f.tenant.id, purchase.id, {
      amount: 25,
      paymentMethod: PaymentMethod.CASH,
      cashSessionId: f.cashSession.id,
    })
    assert.equal(Number(created.balance), 75)
    const stored = await prisma.purchaseDebtPayment.findFirst({ where: { purchaseDebtId: debt.id } })
    assert.equal(stored.cashSessionId, f.cashSession.id)
    assert.equal(stored.paymentMethod, PaymentMethod.CASH)
    assert.equal(Number(stored.amount), 25)
    const totals = await cashTotals(f)
    assert.equal(totals.totalCashPurchaseDebtPayments, 25)
    assert.equal(totals.unclassifiedSupplierPayments, 0)
    assert.equal(totals.expectedCashAmount, 75)
  }))

test('supplier TRANSFER reduces debt and commercial totals without reducing physical cash', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const payments = new PurchaseDebtService(prisma)
    const created = await payments.registerPayment(f.tenant.id, purchase.id, {
      amount: 100,
      paymentMethod: PaymentMethod.TRANSFER,
    })
    const stored = await prisma.purchaseDebtPayment.findFirst({ where: { purchaseDebtId: debt.id } })
    assert.equal(Number(created.balance), 0)
    assert.equal(stored.paymentMethod, PaymentMethod.TRANSFER)
    assert.equal(stored.cashSessionId, f.cashSession.id)
    const totals = await cashTotals(f)
    assert.equal(totals.totalPurchaseDebtPayments, 100)
    assert.equal(totals.totalElectronicPurchaseDebtPayments, 100)
    assert.equal(totals.totalCashPurchaseDebtPayments, 0)
    assert.equal(totals.unclassifiedSupplierPayments, 0)
    assert.equal(totals.expectedCashAmount, 100)
  }))

test('mixed supplier CASH and TRANSFER payments affect debt and drawer by their actual tenders', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const payments = new PurchaseDebtService(prisma)
    await payments.registerPayment(f.tenant.id, purchase.id, {
      amount: 20,
      paymentMethod: PaymentMethod.CASH,
      cashSessionId: f.cashSession.id,
    })
    await payments.registerPayment(f.tenant.id, purchase.id, {
      amount: 30,
      paymentMethod: PaymentMethod.TRANSFER,
      cashSessionId: f.cashSession.id,
    })
    const [totals, updatedDebt] = await Promise.all([
      cashTotals(f),
      prisma.purchaseDebt.findUnique({ where: { id: debt.id } }),
    ])
    assert.equal(Number(updatedDebt.balance), 50)
    assert.equal(totals.totalPurchaseDebtPayments, 50)
    assert.equal(totals.totalCashPurchaseDebtPayments, 20)
    assert.equal(totals.totalElectronicPurchaseDebtPayments, 30)
    assert.equal(totals.expectedCashAmount, 80)
    const closed = await new CashSessionService(prisma).close(
      f.tenant.id,
      f.cashSession.id,
      { closingAmount: 80 },
    )
    assert.equal(Number(closed.expectedAmount), 80)
    assert.equal(Number(closed.difference), 0)
  }))

test('old unclassified supplier payments do not block an unrelated new session or rewrite a closed snapshot', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { debt } = await createSupplierDebt(f)
    const priorSession = await prisma.cashSession.create({
      data: {
        tenantId: f.tenant.id,
        openedBy: f.user.id,
        openingAmount: 0,
        closingAmount: 0,
        expectedAmount: 123,
        difference: -123,
        status: 'CLOSED',
        openedAt: new Date('2026-11-01T08:00:00.000Z'),
        closedAt: new Date('2026-11-01T17:00:00.000Z'),
      },
    })
    await prisma.purchaseDebtPayment.createMany({
      data: [
        {
          tenantId: f.tenant.id,
          purchaseDebtId: debt.id,
          amount: 10,
          paymentDate: new Date('2026-11-01T12:00:00.000Z'),
          cashSessionId: priorSession.id,
        },
        {
          tenantId: f.tenant.id,
          purchaseDebtId: debt.id,
          amount: 5,
          paymentDate: new Date('2026-11-01T13:00:00.000Z'),
        },
      ],
    })
    const totals = await cashTotals(f)
    assert.equal(totals.unclassifiedSupplierPayments, 0)
    assert.equal(totals.expectedCashAmount, 100)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: priorSession.id } })).expectedAmount), 123)
  }))

test('new supplier TRANSFER cannot be backdated into a closed cash-session report', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const cash = new CashSessionService(prisma)
    const closed = await cash.close(f.tenant.id, f.cashSession.id, { closingAmount: 100 })
    const closedSession = await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })
    const paymentDate = new Date(closedSession.openedAt)
    assert.equal(closedSession.status, 'CLOSED')
    assert.ok(closedSession.closedAt)
    assert.ok(closedSession.openedAt <= paymentDate)
    assert.ok(closedSession.closedAt >= paymentDate)
    assert.equal(await prisma.cashSession.count({ where: { tenantId: f.tenant.id, status: 'OPEN' } }), 0)
    await assert.rejects(
      new PurchaseDebtService(prisma).registerPayment(f.tenant.id, purchase.id, {
        amount: 20,
        paymentMethod: PaymentMethod.TRANSFER,
        paymentDate: paymentDate.toISOString(),
      }),
      (error) => error.getStatus?.() === 409,
    )
    assert.equal(await prisma.purchaseDebtPayment.count({ where: { purchaseDebtId: debt.id } }), 0)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).expectedAmount), 100)
    assert.equal(Number(closed.expectedAmount), 100)
  }))

test('supplier payment rejects missing or unsupported methods and overpayment', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const payments = new PurchaseDebtService(prisma)
    for (const paymentMethod of [undefined, PaymentMethod.CARD, PaymentMethod.CREDIT]) {
      await assert.rejects(
        payments.registerPayment(f.tenant.id, purchase.id, {
          amount: 10,
          paymentMethod,
          cashSessionId: f.cashSession.id,
        }),
        (error) => error.getStatus?.() === 400,
      )
    }
    await assert.rejects(
      payments.registerPayment(f.tenant.id, purchase.id, {
        amount: 101,
        paymentMethod: PaymentMethod.CASH,
        cashSessionId: f.cashSession.id,
      }),
      (error) => error.getStatus?.() === 400,
    )
    assert.equal(await prisma.purchaseDebtPayment.count({ where: { purchaseDebtId: debt.id } }), 0)
    assert.equal(Number((await prisma.purchaseDebt.findUnique({ where: { id: debt.id } })).balance), 100)
  }))

test('supplier payment rollback restores debt if installment application fails', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const installment = await prisma.purchaseDebtInstallment.create({
      data: {
        purchaseDebtId: debt.id,
        number: 1,
        amount: 10,
        dueDate: new Date('2026-12-01T00:00:00.000Z'),
      },
    })
    await assert.rejects(
      new PurchaseDebtService(prisma).registerPayment(f.tenant.id, purchase.id, {
        amount: 20,
        paymentMethod: PaymentMethod.CASH,
        cashSessionId: f.cashSession.id,
        installmentId: installment.id,
      }),
      (error) => error.getStatus?.() === 400,
    )
    assert.equal(await prisma.purchaseDebtPayment.count({ where: { purchaseDebtId: debt.id } }), 0)
    const unchanged = await prisma.purchaseDebt.findUnique({ where: { id: debt.id } })
    assert.equal(Number(unchanged.paidAmount), 0)
    assert.equal(Number(unchanged.balance), 100)
    assert.equal(Number((await prisma.purchaseDebtInstallment.findUnique({ where: { id: installment.id } })).paidAmount), 0)
  }))

test('concurrent supplier payments serialize against the remaining debt balance', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const payments = new PurchaseDebtService(prisma)
    const attempts = await Promise.allSettled([
      payments.registerPayment(f.tenant.id, purchase.id, {
        amount: 60,
        paymentMethod: PaymentMethod.CASH,
        cashSessionId: f.cashSession.id,
      }),
      payments.registerPayment(f.tenant.id, purchase.id, {
        amount: 60,
        paymentMethod: PaymentMethod.CASH,
        cashSessionId: f.cashSession.id,
      }),
    ])
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1)
    assert.equal(await prisma.purchaseDebtPayment.count({ where: { purchaseDebtId: debt.id } }), 1)
    assert.equal(Number((await prisma.purchaseDebt.findUnique({ where: { id: debt.id } })).balance), 40)
  }))

test('supplier CASH payment racing with close is included or rejected, never omitted from the snapshot', () =>
  fixtureTest({ openingAmount: 100 }, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const payments = new PurchaseDebtService(prisma)
    const [payment, closed] = await Promise.allSettled([
      payments.registerPayment(f.tenant.id, purchase.id, {
        amount: 20,
        paymentMethod: PaymentMethod.CASH,
        cashSessionId: f.cashSession.id,
      }),
      new CashSessionService(prisma).close(f.tenant.id, f.cashSession.id, { closingAmount: 80 }),
    ])
    assert.equal(closed.status, 'fulfilled')
    const paymentCount = await prisma.purchaseDebtPayment.count({ where: { purchaseDebtId: debt.id } })
    if (payment.status === 'fulfilled') {
      assert.equal(paymentCount, 1)
      assert.equal(Number(closed.value.expectedAmount), 80)
    } else {
      assert.equal(paymentCount, 0)
      assert.equal(Number(closed.value.expectedAmount), 100)
      assert.equal(Number((await prisma.purchaseDebt.findUnique({ where: { id: debt.id } })).balance), 100)
    }
  }))

test('supplier payment rejects a foreign or closed cash session', () =>
  fixtureTest({}, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const foreignTenant = await prisma.tenant.create({
      data: { name: `Foreign ${randomUUID()}`, slug: `foreign-${randomUUID()}` },
    })
    const foreignUser = await prisma.user.create({
      data: {
        tenantId: foreignTenant.id,
        name: 'Foreign fixture user',
        email: `${randomUUID()}@integration.invalid`,
        password: 'fixture-only-not-a-real-credential',
      },
    })
    const foreignSession = await prisma.cashSession.create({
      data: { tenantId: foreignTenant.id, openedBy: foreignUser.id, openingAmount: 0 },
    })
    const payments = new PurchaseDebtService(prisma)
    try {
      await assert.rejects(
        payments.registerPayment(f.tenant.id, purchase.id, {
          amount: 25,
          paymentMethod: PaymentMethod.CASH,
          cashSessionId: foreignSession.id,
        }),
        (error) => error.getStatus?.() === 400,
      )
      await new CashSessionService(prisma).close(f.tenant.id, f.cashSession.id, { closingAmount: 0 })
      await assert.rejects(
        payments.registerPayment(f.tenant.id, purchase.id, {
          amount: 25,
          paymentMethod: PaymentMethod.CASH,
          cashSessionId: f.cashSession.id,
        }),
        (error) => error.getStatus?.() === 400,
      )
      await assert.rejects(
        payments.registerPayment(foreignTenant.id, purchase.id, {
          amount: 25,
          paymentMethod: PaymentMethod.CASH,
          cashSessionId: foreignSession.id,
        }),
        (error) => error.getStatus?.() === 404,
      )
      assert.equal(await prisma.purchaseDebtPayment.count({ where: { purchaseDebtId: debt.id } }), 0)
    } finally {
      await prisma.cashSession.deleteMany({ where: { tenantId: foreignTenant.id } })
      await prisma.user.delete({ where: { id: foreignUser.id } })
      await prisma.tenant.delete({ where: { id: foreignTenant.id } })
    }
  }))

test('payment void is allowed while its cash session is open', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      items: itemsFor(f.products),
    })
    const payments = makeCustomerPaymentService()
    const payment = (await payments.payToAccount(f.tenant.id, {
      customerId: f.customer.id,
      amount: 25,
      paymentMethod: PaymentMethod.CASH,
    })).payments[0]
    await payments.voidPayment(payment.id, f.tenant.id, { reason: 'Integration fixture correction' })
    const totals = await cashTotals(f)
    assert.equal(totals.totalCashDebtPayments, 0)
    assert.equal(totals.expectedCashAmount, 0)
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 100)
  }))

test('payment void is blocked after its cash session closes', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      items: itemsFor(f.products),
    })
    const payments = makeCustomerPaymentService()
    const payment = (await payments.payToAccount(f.tenant.id, {
      customerId: f.customer.id,
      amount: 25,
      paymentMethod: PaymentMethod.CASH,
    })).payments[0]
    await new CashSessionService(prisma).close(f.tenant.id, f.cashSession.id, { closingAmount: 25 })
    await assert.rejects(
      payments.voidPayment(payment.id, f.tenant.id, { reason: 'Must preserve closed session' }),
      (error) => error.getStatus?.() === 409,
    )
    assert.equal((await prisma.customerPayment.findUnique({ where: { id: payment.id } })).isVoided, false)
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 75)
  }))

for (const count of [1, 5, 10, 20]) {
  test(`real PostgreSQL sale with ${count} products records stock movements and transaction timings`, () =>
    fixtureTest({ productCount: count, stock: 10 }, async (f) => {
      const { service } = makeSaleService()
      const startedAt = performance.now()
      const sale = await service.create(f.tenant.id, f.cashSession.id, {
        paymentMethod: PaymentMethod.CASH,
        items: itemsFor(f.products),
      })
      const elapsedMs = Math.round(performance.now() - startedAt)
      const items = await prisma.saleItem.findMany({ where: { saleId: sale.id } })
      const [movements, products] = await Promise.all([
        prisma.stockMovement.findMany({ where: { referenceId: { in: items.map((item) => item.id) } } }),
        prisma.product.findMany({ where: { id: { in: f.products.map((product) => product.id) } } }),
      ])
      assert.equal(items.length, count)
      assert.equal(movements.length, count)
      assert.equal(products.every((product) => product.stock === 9), true)
      for (const movement of movements) {
        assert.equal(movement.before - movement.after, 1)
        assert.equal(movement.quantity, -1)
        assert.equal(movement.type, 'SALE')
      }
      assert.deepEqual(latestTransactionCounts, {
        'sale.create': 1,
        ...Object.fromEntries([
          ['saleItem.create', count],
          ['$queryRaw', count],
          ['stockMovement.create', count],
          ['cashSession.updateMany', 1],
          ['cashSession.update', 1],
          ['sale.findUnique', 1],
        ]),
      })
      assert.equal(latestSaleLog.outcome, 'success')
      assert.equal(latestSaleLog.itemCount, count)
      assert.equal(latestSaleLog.stagesMs.itemsAndStock >= 0, true)
      assert.equal(latestSaleLog.durationMs >= 0, true)
      assert.equal(latestSaleLog.durationMs <= 15_000, true)
      assert.equal(latestRawQueryShape.values[0], 1)
      assert.equal(f.products.some((product) => product.id === latestRawQueryShape.values[1]), true)
      assert.equal(latestRawQueryShape.values[2], f.tenant.id)
      assert.equal(latestRawQueryShape.values[3], 1)
      assert.equal(latestRawQueryShape.template.includes(f.tenant.id), false)
      assert.equal(f.products.some((product) => latestRawQueryShape.template.includes(product.id)), false)
      assert.match(latestRawQueryShape.template, /WHERE "id" = \?/)
      assert.match(latestRawQueryShape.template, /AND "tenantId" = \?/)
      assert.match(latestRawQueryShape.template, /AND "isActive" = TRUE/)
      assert.match(latestRawQueryShape.template, /AND "stock" >= \?/)
      assert.match(latestRawQueryShape.template, /SET "stock" = "stock" - \?/)
      performanceResults.push({
        itemCount: count,
        totalWallMs: elapsedMs,
        transactionMs: latestSaleLog.durationMs,
        stageMs: latestSaleLog.stagesMs,
        prismaOperations: latestTransactionCounts,
        parameterizedStockSql: true,
      })
    }))
}

test('insufficient stock creates no partial sale', () =>
  fixtureTest({ stock: 0 }, async (f) => {
    const { service } = makeSaleService()
    await assert.rejects(
      service.create(f.tenant.id, f.cashSession.id, {
        paymentMethod: PaymentMethod.CASH,
        items: itemsFor(f.products),
      }),
      (error) => error.getStatus?.() === 400,
    )
    assert.equal(await prisma.sale.count({ where: { tenantId: f.tenant.id } }), 0)
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 0)
  }))

test('two concurrent sales cannot sell the same final unit', () =>
  fixtureTest({ stock: 1 }, async (f) => {
    const { service } = makeSaleService()
    let releaseValidationBarrier
    const validationBarrier = new Promise((resolve) => { releaseValidationBarrier = resolve })
    let validationsCompleted = 0
    const validateProducts = service.saleValidationService.validateAndFetchProducts.bind(service.saleValidationService)
    service.saleValidationService.validateAndFetchProducts = async (...args) => {
      const products = await validateProducts(...args)
      validationsCompleted += 1
      if (validationsCompleted === 2) releaseValidationBarrier()
      await validationBarrier
      return products
    }
    let sampling = true
    const lockWaitSamples = []
    const sampler = (async () => {
      while (sampling) {
        const rows = await prisma.$queryRaw`
          SELECT wait_event_type, wait_event
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND application_name = current_setting('application_name')
            AND pid <> pg_backend_pid()
            AND wait_event_type = 'Lock'
        `
        if (rows.length) lockWaitSamples.push(rows.length)
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
    })()
    const startedAt = performance.now()
    const outcomes = await Promise.allSettled([
      service.create(f.tenant.id, f.cashSession.id, { paymentMethod: PaymentMethod.CASH, items: itemsFor(f.products) }),
      service.create(f.tenant.id, f.cashSession.id, { paymentMethod: PaymentMethod.CASH, items: itemsFor(f.products) }),
    ])
    const elapsedMs = Math.round(performance.now() - startedAt)
    sampling = false
    await sampler
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1)
    assert.equal(await prisma.sale.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal(await prisma.saleItem.count({ where: { sale: { tenantId: f.tenant.id } } }), 1)
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 1)
    const movement = await prisma.stockMovement.findFirst({ where: { tenantId: f.tenant.id } })
    assert.equal(movement.before, 1)
    assert.equal(movement.after, 0)
    assert.equal((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock, 0)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).totalSales), 100)
    performanceResults.push({ concurrency: 'same final unit', totalWallMs: elapsedMs, lockWaitSamples: lockWaitSamples.length })
  }))

test('failure after a stock movement rolls back the complete sale transaction', () =>
  fixtureTest({ productCount: 2, stock: 5 }, async (f) => {
    const credit = new SaleCreditService(prisma)
    const originalProcessCredit = credit.processCreditDebtAndPayments.bind(credit)
    credit.processCreditDebtAndPayments = async (...args) => {
      await originalProcessCredit(...args)
      throw new Error('intentional integration failure after credit and cash writes')
    }
    const { service } = makeSaleService(undefined, credit)
    await assert.rejects(service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      amountPaid: 50,
      initialPaymentMethod: PaymentMethod.CASH,
      items: itemsFor(f.products),
    }, 'rollback-after-stock-key'), /intentional integration failure after credit and cash writes/)
    assert.equal(await prisma.sale.count({ where: { tenantId: f.tenant.id } }), 0)
    assert.equal(await prisma.saleItem.count({ where: { sale: { tenantId: f.tenant.id } } }), 0)
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 0)
    const products = await prisma.product.findMany({ where: { id: { in: f.products.map((p) => p.id) } } })
    assert.equal(products.every((product) => product.stock === 5), true)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).totalSales), 0)
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 0)
    assert.equal(await prisma.customerPayment.count({ where: { tenantId: f.tenant.id } }), 0)
    assert.equal(await prisma.idempotencyRecord.count({ where: { tenantId: f.tenant.id, key: 'rollback-after-stock-key' } }), 0)
  }))

test('product inventory pagination remains correct at 100, 101 and 1,000 records', () =>
  fixtureTest({ productCount: 1 }, async (f) => {
    const productService = new ProductService(prisma, new StockMovementService(prisma))
    const prefix = randomUUID().replaceAll('-', '').slice(0, 10)
    let next = 1
    const addProducts = async (count) => {
      const rows = Array.from({ length: count }, (_, offset) => {
        const index = next + offset
        return {
          id: randomUUID(),
          tenantId: f.tenant.id,
          categoryId: f.category.id,
          name: `Catalog ${prefix} ${index}`,
          sku: `CAT-${prefix}-${index}`,
          price: 100,
          wholesalePrice: 50,
          cost: 25,
          stock: 10,
        }
      })
      await prisma.product.createMany({ data: rows })
      next += count
    }
    const page = async (pageNumber, limit = 100) => productService.findAll(f.tenant.id, {
      page: pageNumber,
      limit,
      skip: (pageNumber - 1) * limit,
    })

    await addProducts(99)
    assert.equal((await page(1)).total, 100)
    assert.equal((await page(1)).items.length, 100)

    await addProducts(1)
    const page101First = await page(1)
    const page101Second = await page(2)
    assert.equal(page101First.total, 101)
    assert.equal(page101First.items.length, 100)
    assert.equal(page101Second.items.length, 1)

    await addProducts(899)
    const page1000Last = await page(10)
    assert.equal(page1000Last.total, 1_000)
    assert.equal(page1000Last.items.length, 100)

    await addProducts(1)
    const page1001Last = await page(11)
    assert.equal(page1001Last.total, 1_001)
    assert.equal(page1001Last.items.length, 1)
  }))

test('low stock comparison is server-side, inclusive, decimal-safe and tenant-scoped', () =>
  fixtureTest({}, async (f) => {
    const foreign = await createFixture()
    try {
      await prisma.product.createMany({
        data: [
          { tenantId: f.tenant.id, categoryId: f.category.id, name: 'Below minimum', sku: `LOW-${randomUUID()}`, price: 10, cost: 1, stock: 1.25, stockMinimum: 2.5 },
          { tenantId: f.tenant.id, categoryId: f.category.id, name: 'At minimum', sku: `EQUAL-${randomUUID()}`, price: 10, cost: 1, stock: 2.5, stockMinimum: 2.5 },
          { tenantId: f.tenant.id, categoryId: f.category.id, name: 'Zero at zero', sku: `ZERO-${randomUUID()}`, price: 10, cost: 1, stock: 0, stockMinimum: 0 },
          { tenantId: f.tenant.id, categoryId: f.category.id, name: 'Above minimum', sku: `HIGH-${randomUUID()}`, price: 10, cost: 1, stock: 2.51, stockMinimum: 2.5 },
          { tenantId: foreign.tenant.id, categoryId: foreign.category.id, name: 'Foreign low', sku: `FOREIGN-${randomUUID()}`, price: 10, cost: 1, stock: 0, stockMinimum: 10 },
        ],
      })
      const productService = new ProductService(prisma, new StockMovementService(prisma))
      const low = await productService.findAll(f.tenant.id, { page: 1, limit: 100, skip: 0, lowStock: true })
      const normal = await productService.findAll(f.tenant.id, { page: 1, limit: 100, skip: 0, stockStatus: 'NORMAL' })
      assert.equal(low.total, 3)
      assert.deepEqual(new Set(low.items.map((product) => product.name)), new Set(['Below minimum', 'At minimum', 'Zero at zero']))
      assert.equal(normal.total, 2)
      assert.equal(normal.items.some((product) => product.name === 'Above minimum'), true)
      assert.equal(low.items.some((product) => product.name === 'Foreign low'), false)
    } finally {
      await cleanupFixture(foreign)
    }
  }))

test('product selector preserves zero-prefixed codes, active rules, tenant scope and bounded results', () =>
  fixtureTest({}, async (f) => {
    const foreign = await createFixture()
    try {
      const sharedCode = `0000${randomUUID().slice(0, 8)}`
      await prisma.product.createMany({
        data: [
          { tenantId: f.tenant.id, categoryId: f.category.id, name: 'Active zero barcode', sku: `ACTIVE-${randomUUID()}`, barcode: sharedCode, price: 10, cost: 1, stock: 3, isActive: true },
          { tenantId: f.tenant.id, categoryId: f.category.id, name: 'Inactive zero barcode', sku: `INACTIVE-${randomUUID()}`, barcode: `${sharedCode}9`, price: 10, cost: 1, stock: 3, isActive: false },
          { tenantId: foreign.tenant.id, categoryId: foreign.category.id, name: 'Foreign zero barcode', sku: `FOREIGN-${randomUUID()}`, barcode: sharedCode, price: 10, cost: 1, stock: 3, isActive: true },
        ],
      })
      const productService = new ProductService(prisma, new StockMovementService(prisma))
      const matches = await productService.searchForSelector(f.tenant.id, { search: sharedCode, isActive: true, limit: 30 })
      assert.equal(matches.items.length, 1)
      assert.equal(matches.items[0].barcode, sharedCode)
      assert.equal(matches.hasMore, false)

      const unrestricted = await productService.searchForSelector(f.tenant.id, { search: sharedCode, limit: 30 })
      assert.equal(unrestricted.items.length, 2)
      assert.equal(unrestricted.items.some((product) => product.name === 'Foreign zero barcode'), false)
    } finally {
      await cleanupFixture(foreign)
    }
  }))

test('customer search finds debtors beyond the first page without crossing tenants', () =>
  fixtureTest({}, async (f) => {
    const foreign = await createFixture()
    try {
      const prefix = randomUUID().replaceAll('-', '').slice(0, 10)
      await prisma.customer.createMany({
        data: Array.from({ length: 130 }, (_, index) => ({
          tenantId: f.tenant.id,
          name: index === 129 ? `Remote debtor ${prefix}` : `Customer page ${prefix} ${index}`,
          currentDebt: index === 129 ? 125 : 0,
          creditLimit: 500,
          creditEnabled: true,
        })),
      })
      await prisma.customer.create({
        data: { tenantId: foreign.tenant.id, name: `Remote debtor ${prefix}`, currentDebt: 500, creditLimit: 500, creditEnabled: true },
      })
      const customerService = new CustomerService(prisma)
      const results = await customerService.findAll(f.tenant.id, {
        search: prefix,
        hasDebt: true,
        page: 1,
        limit: 10,
      })
      assert.equal(results.total, 1)
      assert.equal(results.items[0].name, `Remote debtor ${prefix}`)
    } finally {
      await cleanupFixture(foreign)
    }
  }))

test('sales history search finds a customer sale outside the unfiltered first page', () =>
  fixtureTest({}, async (f) => {
    const target = await prisma.customer.create({
      data: { tenantId: f.tenant.id, name: `History target ${randomUUID()}` },
    })
    const now = Date.now()
    await prisma.sale.createMany({
      data: Array.from({ length: 11 }, (_, index) => ({
        tenantId: f.tenant.id,
        cashSessionId: f.cashSession.id,
        customerId: index === 10 ? target.id : f.customer.id,
        saleDate: new Date(now - index * 60_000),
        total: 100 + index,
      })),
    })
    const unfilteredPage = await prisma.sale.findMany({
      where: { tenantId: f.tenant.id },
      orderBy: { saleDate: 'desc' },
      take: 10,
    })
    assert.equal(unfilteredPage.some((sale) => sale.customerId === target.id), false)

    const stockMovementService = new StockMovementService(prisma)
    const productService = new ProductService(prisma, stockMovementService)
    const service = new SaleService(
      prisma,
      stockMovementService,
      new SaleValidationService(prisma, productService),
      new SaleCreditService(prisma),
    )
    const results = await service.findAll(f.tenant.id, { search: target.name, page: 1, limit: 10 })
    assert.equal(results.total, 1)
    assert.equal(results.items[0].customerId, target.id)
  }))

test('two concurrent returns of four units against a five-unit purchase allow exactly one confirmation', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const service = makePurchaseReturnService()
    const first = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 4 }]))
    const second = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 4 }]))

    const outcomes = await Promise.allSettled([
      confirmReturn(service, first, f.tenant.id),
      confirmReturn(service, second, f.tenant.id),
    ])
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 1)
    const confirmed = await prisma.purchaseReturnItem.aggregate({
      where: { purchaseReturn: { purchaseId: purchase.id, status: 'CONFIRMED' } },
      _sum: { quantity: true },
    })
    assert.equal(confirmed._sum.quantity, 4)
    const moves = await prisma.stockMovement.findMany({ where: { referenceId: { in: [first.id, second.id] } } })
    assert.equal(moves.length, 1)
    assert.deepEqual([moves[0].before, moves[0].after, moves[0].quantity], [5, 1, -4])
  }))

test('concurrent confirmations of the same return create one stock movement', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const service = makePurchaseReturnService()
    const returned = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 2 }]))
    const outcomes = await Promise.allSettled([
      confirmReturn(service, returned, f.tenant.id),
      confirmReturn(service, returned, f.tenant.id),
    ])
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1)
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: returned.id } }), 1)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 3)
  }))

test('duplicate purchase item ids in one return request are rejected', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const service = makePurchaseReturnService()
    await assert.rejects(
      service.create(f.tenant.id, createReturnDto(purchase, [
        { purchaseItemId: item.id, quantity: 4 },
        { purchaseItemId: item.id, quantity: 4 },
      ])),
      /No puede repetirse/,
    )
    assert.equal(await prisma.purchaseReturn.count({ where: { purchaseId: purchase.id } }), 0)
  }))

test('unit-count products reject decimal return quantities', () =>
  fixtureTest({ stock: 5, unitType: 'UNIT' }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const service = makePurchaseReturnService()
    await assert.rejects(
      service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 0.5 }])),
      /no admite cantidades decimales/,
    )
    assert.equal(await prisma.purchaseReturn.count({ where: { purchaseId: purchase.id } }), 0)
  }))

test('partial returns accumulate exactly and reject quantities above the remaining original amount', () =>
  fixtureTest({ stock: 5, unitType: 'KG' }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const service = makePurchaseReturnService()
    const first = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 2.25 }]))
    await confirmReturn(service, first, f.tenant.id)
    const second = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 2.25 }]))
    await confirmReturn(service, second, f.tenant.id)
    await assert.rejects(
      service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 0.75 }])),
      /Solo quedan 0.5 unidades disponibles/,
    )
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 0.5)
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: { in: [first.id, second.id] } } }), 2)
    assert.equal((await prisma.purchase.findUnique({ where: { id: purchase.id } })).status, 'RECEIVED')
  }))

test('return and sale racing for stock either succeeds alone or preserves the correct remainder', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const returnService = makePurchaseReturnService()
    const returned = await returnService.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 4 }]))
    const { service: saleService } = makeSaleService()
    const outcomes = await Promise.allSettled([
      confirmReturn(returnService, returned, f.tenant.id),
      saleService.create(f.tenant.id, f.cashSession.id, {
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: f.products[0].id, quantity: 2, unitPrice: 100, priceType: PriceType.PUBLIC }],
      }),
    ])
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1)
    const product = await prisma.product.findUnique({ where: { id: f.products[0].id } })
    assert.ok([1, 3].includes(Number(product.stock)))
    const returnStatus = (await prisma.purchaseReturn.findUnique({ where: { id: returned.id } })).status
    assert.equal(returnStatus, Number(product.stock) === 1 ? 'CONFIRMED' : 'PENDING')
  }))

test('return creation and purchase cancellation serialize on the original purchase', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const returnService = makePurchaseReturnService()
    const purchaseService = makePurchaseService()
    const outcomes = await Promise.allSettled([
      returnService.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 4 }])),
      purchaseService.cancel(purchase.id, f.tenant.id, f.user.id, { reason: 'Registro equivocado', supplierReceivedNothing: true }),
    ])
    assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1)
    const finalPurchase = await prisma.purchase.findUnique({ where: { id: purchase.id } })
    assert.equal(finalPurchase.status, 'RECEIVED')
    assert.equal(await prisma.purchaseReturn.count({ where: { purchaseId: purchase.id } }), 1)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 5)
  }))

test('cash purchase cancellation is blocked without an actual supplier refund and leaves the cash snapshot untouched', () =>
  fixtureTest({ stock: 5, openingAmount: 200 }, async (f) => {
    const { purchase } = await createPurchaseWithItem(f, 5)
    const before = await cashTotals(f)
    await assert.rejects(makePurchaseService().cancel(purchase.id, f.tenant.id, f.user.id, { reason: 'Registro equivocado', supplierReceivedNothing: true }), /efectivo ya entregado/)
    const after = await cashTotals(f)
    assert.equal(before.expectedCashAmount, 100)
    assert.equal(after.expectedCashAmount, 100)
    assert.equal((await prisma.purchase.findUnique({ where: { id: purchase.id } })).status, 'RECEIVED')
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: f.tenant.id } }), 0)
  }))

test('unpaid credit purchase cancellation requires actor and reason and marks only its debt obligation cancelled', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { purchase } = await createPurchaseWithItem(f, 5, { paymentType: 'CREDIT' })
    await prisma.purchaseDebt.create({ data: { tenantId: f.tenant.id, purchaseId: purchase.id, totalAmount: 100, balance: 100 } })
    const cancelled = await makePurchaseService().cancel(purchase.id, f.tenant.id, f.user.id, {
      reason: 'Factura duplicada por error', supplierReceivedNothing: true,
    })
    assert.equal(cancelled.status, 'CANCELLED')
    const debt = await prisma.purchaseDebt.findUnique({ where: { purchaseId: purchase.id } })
    assert.equal(debt.status, 'CANCELLED')
    assert.equal(Number(debt.balance), 0)
    const event = await prisma.purchaseLifecycleEvent.findFirst({ where: { purchaseId: purchase.id } })
    assert.equal(event.actorId, f.user.id)
    assert.equal(event.reason, 'Factura duplicada por error')
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 0)
  }))

test('sale cancellation is restricted to unpaid credit errors and restoration reverses only its audited effects', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { service: sales } = makeSaleService()
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT, customerId: f.customer.id,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const cancelled = await sales.cancel(sale.id, f.tenant.id, f.user.id, 'Venta ingresada por error')
    assert.equal(cancelled.status, 'CANCELLED')
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 0)
    await sales.uncancel(sale.id, f.tenant.id, f.user.id, 'Corrección de anulación equivocada')
    assert.equal((await prisma.sale.findUnique({ where: { id: sale.id } })).status, 'COMPLETED')
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 100)
    assert.deepEqual((await prisma.saleLifecycleEvent.findMany({ where: { saleId: sale.id }, orderBy: { createdAt: 'asc' } })).map(event => event.action), ['CANCEL', 'RESTORE'])
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 4)
  }))

test('sale cancellation refuses a paid cash transaction and does not adjust the drawer', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { service: sales } = makeSaleService()
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const before = Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).totalSales)
    await assert.rejects(sales.cancel(sale.id, f.tenant.id, f.user.id, 'Venta registrada por error'), /dinero recibido/)
    assert.equal((await prisma.sale.findUnique({ where: { id: sale.id } })).status, 'COMPLETED')
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).totalSales), before)
  }))

test('dashboard keeps gross billing and confirmed returns separate and reports net billing', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { service: sales } = makeSaleService()
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const returns = makeSaleReturnService()
    const returned = await returns.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    })
    await returns.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' })
    const dashboard = new DashboardService(prisma, new CashSessionService(prisma))
    const stats = await dashboard.getStats(f.tenant.id)
    assert.equal(stats.billing.today, 100)
    assert.equal(stats.billing.todayReturns, 100)
    assert.equal(stats.billing.netToday, 0)
    assert.equal(stats.billing.month, 100)
    assert.equal(stats.billing.monthReturns, 100)
    assert.equal(stats.billing.netMonth, 0)
  }))

test('sale return offsets credit debt first and records partial refund receipts without rewriting the original payment', () =>
  fixtureTest({ stock: 10, openingAmount: 250 }, async (f) => {
    const { service: sales } = makeSaleService()
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT, customerId: f.customer.id, amountPaid: 400,
      initialPaymentMethod: 'TRANSFER',
      items: [{ productId: f.products[0].id, quantity: 10, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const originalPayment = await prisma.customerPayment.findFirst({ where: { saleId: sale.id } })
    const service = makeSaleReturnService()
    const returned = await service.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(), reason: 'Returned items',
      items: [{ saleItemId: sale.items[0].id, quantity: 7, disposition: 'RESTOCKABLE' }],
    })
    const confirmed = await service.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' })
    assert.equal(Number(confirmed.total), 700)
    assert.equal(Number(confirmed.debtOffsetAmount), 600)
    assert.equal(Number((await prisma.sale.findUnique({ where: { id: sale.id } })).remainingBalance), 0)
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 0)
    assert.equal(Number((await prisma.customerPayment.findUnique({ where: { id: originalPayment.id } })).amount), 400)
    assert.equal((await prisma.customerPayment.findUnique({ where: { id: originalPayment.id } })).isVoided, false)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 7)
    const settlement = confirmed.settlements[0]
    await service.settleRefund(settlement.id, f.tenant.id, f.user.id, { amount: 40, paymentMethod: 'TRANSFER', effectiveAt: new Date().toISOString() })
    await service.settleRefund(settlement.id, f.tenant.id, f.user.id, { amount: 60, paymentMethod: 'CASH', effectiveAt: new Date().toISOString() })
    const finalSettlement = await prisma.saleReturnSettlement.findUnique({ where: { id: settlement.id }, include: { receipts: true } })
    assert.equal(finalSettlement.status, 'SETTLED')
    assert.equal(finalSettlement.receipts.length, 2)
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: f.tenant.id, type: 'OUT', amount: 60 } }), 1)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).totalSales), 400)
  }))

test('damaged sale returns do not restock and transfer refunds do not change physical cash', () =>
  fixtureTest({ stock: 10, openingAmount: 100 }, async (f) => {
    const { service: sales } = makeSaleService()
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: f.products[0].id, quantity: 2, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const service = makeSaleReturnService()
    const returned = await service.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'DAMAGED' }],
    })
    await service.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_TRANSFER' })
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 8)
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: f.tenant.id } }), 0)
    assert.equal(Number((await prisma.sale.findUnique({ where: { id: sale.id } })).total), 200)
  }))

test('sale restoration never reactivates a payment voided before the cancellation', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const { service: sales } = makeSaleService()
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT, customerId: f.customer.id, amountPaid: 50,
      initialPaymentMethod: 'TRANSFER',
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const payment = await prisma.customerPayment.findFirst({ where: { saleId: sale.id } })
    await prisma.customerPayment.update({ where: { id: payment.id }, data: { isVoided: true, voidedAt: new Date(), voidReason: 'Anulado previamente' } })
    await prisma.customer.update({ where: { id: f.customer.id }, data: { currentDebt: 0 } })
    await prisma.sale.update({ where: { id: sale.id }, data: { status: 'CANCELLED' } })
    await prisma.cashSession.update({ where: { id: f.cashSession.id }, data: { totalSales: 0 } })
    await prisma.product.update({ where: { id: f.products[0].id }, data: { stock: 10 } })
    await prisma.saleLifecycleEvent.create({
      data: { tenantId: f.tenant.id, saleId: sale.id, actorId: f.user.id, action: 'CANCEL', reason: 'Legacy cancellation fixture' },
    })
    await sales.uncancel(sale.id, f.tenant.id, f.user.id, 'Restore the erroneous cancellation')
    const restoredPayment = await prisma.customerPayment.findUnique({ where: { id: payment.id } })
    assert.equal(restoredPayment.isVoided, true)
    assert.equal(restoredPayment.voidReason, 'Anulado previamente')
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 50)
    assert.equal(await prisma.saleLifecycleEvent.count({ where: { saleId: sale.id, action: 'RESTORE' } }), 1)
  }))

test('cancelled return cannot be confirmed and a confirmed retry has no repeated effects', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const service = makePurchaseReturnService()
    const cancelled = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 1 }]))
    await service.cancel(cancelled.id, f.tenant.id)
    await assert.rejects(service.confirm(cancelled.id, f.tenant.id), /estado PENDING/)
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: cancelled.id } }), 0)

    const confirmed = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 1 }]))
    await confirmReturn(service, confirmed, f.tenant.id)
    await assert.rejects(service.confirm(confirmed.id, f.tenant.id), /estado PENDING/)
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: confirmed.id } }), 1)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 4)
  }))

test('return confirmation enforces tenant isolation', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const foreign = await createFixture({ stock: 5 })
    try {
      const { purchase, item } = await createPurchaseWithItem(f, 5)
      const service = makePurchaseReturnService()
      const returned = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 1 }]))
      await assert.rejects(service.confirm(returned.id, foreign.tenant.id), /no encontrada/)
      assert.equal((await prisma.purchaseReturn.findUnique({ where: { id: returned.id } })).status, 'PENDING')
      assert.equal(await prisma.stockMovement.count({ where: { referenceId: returned.id } }), 0)
    } finally {
      await cleanupFixture(foreign)
    }
  }))

test('purchase return offsets nearest unpaid installments without rewriting historical amounts or payments', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5, { paymentType: 'CREDIT' })
    const debt = await prisma.purchaseDebt.create({
      data: {
        tenantId: f.tenant.id, purchaseId: purchase.id, totalAmount: 100, paidAmount: 10,
        balance: 90, status: 'PARTIAL', scheduleType: 'SUPPLIER_SCHEDULE',
        installments: { create: [
          { number: 1, amount: 25, paidAmount: 10, dueDate: new Date('2026-11-15T00:00:00Z'), status: 'PARTIAL' },
          { number: 2, amount: 25, dueDate: new Date('2026-12-15T00:00:00Z') },
          { number: 3, amount: 50, dueDate: new Date('2027-01-15T00:00:00Z') },
        ] },
      }, include: { installments: { orderBy: { number: 'asc' } } },
    })
    const originalPayment = await prisma.purchaseDebtPayment.create({
      data: { tenantId: f.tenant.id, purchaseDebtId: debt.id, installmentId: debt.installments[0].id, amount: 10, notes: 'Pago histórico' },
    })
    const service = makePurchaseReturnService()
    const returned = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 1 }]))
    await confirmReturn(service, returned, f.tenant.id)
    const [updatedDebt, installments, adjustments, payment] = await Promise.all([
      prisma.purchaseDebt.findUnique({ where: { id: debt.id } }),
      prisma.purchaseDebtInstallment.findMany({ where: { purchaseDebtId: debt.id }, orderBy: { number: 'asc' } }),
      prisma.purchaseDebtAdjustment.findMany({ where: { purchaseReturnId: returned.id }, orderBy: { createdAt: 'asc' } }),
      prisma.purchaseDebtPayment.findUnique({ where: { id: originalPayment.id } }),
    ])
    assert.equal(Number(updatedDebt.balance), 70)
    assert.deepEqual(installments.map((row) => Number(row.amount)), [25, 25, 50])
    assert.deepEqual(installments.map((row) => Number(row.paidAmount)), [10, 0, 0])
    assert.deepEqual(adjustments.map((row) => Number(row.amount)), [15, 5])
    assert.equal(Number(payment.amount), 10)
    assert.equal(payment.id, originalPayment.id)
  }))

test('purchase return records excess as pending refund or cash received explicitly', () =>
  fixtureTest({ stock: 5, openingAmount: 30 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const service = makePurchaseReturnService()
    const returned = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 5 }]))
    await assert.rejects(service.confirm(returned.id, f.tenant.id), /Elegí reembolso pendiente/)
    await service.confirm(returned.id, f.tenant.id, { settlementDisposition: 'REFUND_PENDING' })
    const settlement = await prisma.purchaseReturnSettlement.findFirst({ where: { purchaseReturnId: returned.id } })
    assert.equal(settlement.type, 'REFUND')
    assert.equal(settlement.status, 'PENDING')
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: f.tenant.id } }), 0)

    const partialRefund = await service.settleRefund(settlement.id, f.tenant.id, { amount: 40, paymentMethod: 'TRANSFER' })
    assert.equal(partialRefund.status, 'PARTIALLY_SETTLED')
    assert.equal(partialRefund.receipts.length, 1)
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: f.tenant.id, type: 'IN' } }), 0)
    const confirmedRefund = await service.settleRefund(settlement.id, f.tenant.id, { amount: 60, paymentMethod: 'CASH' })
    assert.equal(confirmedRefund.status, 'SETTLED')
    assert.equal(confirmedRefund.receipts.length, 2)
    assert.equal(await prisma.cashMovement.count({ where: { tenantId: f.tenant.id, type: 'IN' } }), 1)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).closingAmount), 0)
  }))

test('pending returns remain available while settlement operations are disabled', () =>
  fixtureTest({ stock: 10, productCount: 2 }, async (f) => {
    const previousPurchaseReturns = process.env.POSENGINE_ENABLE_PURCHASE_RETURNS
    const previousPurchaseSettlements = process.env.POSENGINE_ENABLE_PURCHASE_SETTLEMENTS
    const previousSaleReturns = process.env.POSENGINE_ENABLE_SALE_RETURNS
    const previousSaleRefunds = process.env.POSENGINE_ENABLE_SALE_REFUNDS
    try {
      process.env.POSENGINE_ENABLE_PURCHASE_RETURNS = 'true'
      delete process.env.POSENGINE_ENABLE_PURCHASE_SETTLEMENTS
      const purchaseService = makePurchaseReturnService()
      const { purchase, item } = await createPurchaseWithItem(f, 2)
      const purchaseReturn = await purchaseService.create(f.tenant.id, createReturnDto(purchase, [
        { purchaseItemId: item.id, quantity: 2 },
      ]))
      await purchaseService.confirm(purchaseReturn.id, f.tenant.id, { settlementDisposition: 'REFUND_PENDING' })
      const pendingPurchaseRefund = await prisma.purchaseReturnSettlement.findFirst({ where: { purchaseReturnId: purchaseReturn.id } })
      assert.equal(pendingPurchaseRefund.status, 'PENDING')
      assert.equal(await prisma.cashMovement.count({ where: { tenantId: f.tenant.id } }), 0)

      const blockedPurchase = await createPurchaseWithItem(f, 2, { product: f.products[1] })
      const blockedPurchaseTransfer = await purchaseService.create(f.tenant.id, createReturnDto(blockedPurchase.purchase, [
        { purchaseItemId: blockedPurchase.item.id, quantity: 1 },
      ]))
      await assert.rejects(
        purchaseService.confirm(blockedPurchaseTransfer.id, f.tenant.id, { settlementDisposition: 'REFUND_TRANSFER' }),
        /liquidación de devoluciones de compras está temporalmente deshabilitada/i,
      )
      assert.equal((await prisma.purchaseReturn.findUnique({ where: { id: blockedPurchaseTransfer.id } })).status, 'PENDING')

      process.env.POSENGINE_ENABLE_SALE_RETURNS = 'true'
      delete process.env.POSENGINE_ENABLE_SALE_REFUNDS
      const sale = await makeSaleService().service.create(f.tenant.id, f.cashSession.id, {
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
      })
      const saleReturnService = makeSaleReturnService()
      const saleReturn = await saleReturnService.create(f.tenant.id, f.user.id, {
        saleId: sale.id,
        returnDate: new Date().toISOString(),
        items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
      })
      await saleReturnService.confirm(saleReturn.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' })
      const pendingSaleRefund = await prisma.saleReturnSettlement.findFirst({ where: { saleReturnId: saleReturn.id } })
      assert.equal(pendingSaleRefund.status, 'PENDING')

      const secondSale = await makeSaleService().service.create(f.tenant.id, f.cashSession.id, {
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: f.products[1].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
      })
      const blockedSaleReturn = await saleReturnService.create(f.tenant.id, f.user.id, {
        saleId: secondSale.id,
        returnDate: new Date().toISOString(),
        items: [{ saleItemId: secondSale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
      })
      await assert.rejects(
        saleReturnService.confirm(blockedSaleReturn.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_TRANSFER' }),
        /reembolsos de ventas están temporalmente deshabilitados/i,
      )
      assert.equal((await prisma.saleReturn.findUnique({ where: { id: blockedSaleReturn.id } })).status, 'PENDING')
    } finally {
      if (previousPurchaseReturns === undefined) delete process.env.POSENGINE_ENABLE_PURCHASE_RETURNS
      else process.env.POSENGINE_ENABLE_PURCHASE_RETURNS = previousPurchaseReturns
      if (previousPurchaseSettlements === undefined) delete process.env.POSENGINE_ENABLE_PURCHASE_SETTLEMENTS
      else process.env.POSENGINE_ENABLE_PURCHASE_SETTLEMENTS = previousPurchaseSettlements
      if (previousSaleReturns === undefined) delete process.env.POSENGINE_ENABLE_SALE_RETURNS
      else process.env.POSENGINE_ENABLE_SALE_RETURNS = previousSaleReturns
      if (previousSaleRefunds === undefined) delete process.env.POSENGINE_ENABLE_SALE_REFUNDS
      else process.env.POSENGINE_ENABLE_SALE_REFUNDS = previousSaleRefunds
    }
  }))

test('supplier cash refund cannot be recorded into a closed cash session', () =>
  fixtureTest({ stock: 5, openingAmount: 200 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 5)
    const service = makePurchaseReturnService()
    const returned = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 5 }]))
    await service.confirm(returned.id, f.tenant.id, { settlementDisposition: 'REFUND_PENDING' })
    const settlement = await prisma.purchaseReturnSettlement.findFirst({ where: { purchaseReturnId: returned.id } })
    const closed = await new CashSessionService(prisma).close(f.tenant.id, f.cashSession.id, { closingAmount: 100 })
    await assert.rejects(service.settleRefund(settlement.id, f.tenant.id, { amount: 100, paymentMethod: 'CASH' }), /exactamente una caja abierta/)
    const [unchanged, cashMovements] = await Promise.all([
      prisma.cashSession.findUnique({ where: { id: f.cashSession.id } }),
      prisma.cashMovement.count({ where: { cashSessionId: f.cashSession.id } }),
    ])
    assert.equal(unchanged.status, 'CLOSED')
    assert.equal(Number(unchanged.closingAmount), Number(closed.closingAmount))
    assert.equal(Number(unchanged.expectedAmount), Number(closed.expectedAmount))
    assert.equal(cashMovements, 0)
  }))

test('supplier credit is traceably applied to a future credit purchase for the same supplier', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const { supplier, purchase, item } = await createPurchaseWithItem(f, 5, { paymentType: 'CREDIT' })
    await prisma.purchaseDebt.create({
      data: { tenantId: f.tenant.id, purchaseId: purchase.id, totalAmount: 100, paidAmount: 100, balance: 0, status: 'PAID' },
    })
    const service = makePurchaseReturnService()
    const returned = await service.create(f.tenant.id, createReturnDto(purchase, [{ purchaseItemId: item.id, quantity: 5 }]))
    await service.confirm(returned.id, f.tenant.id, { settlementDisposition: 'SUPPLIER_CREDIT' })
    const credit = await prisma.purchaseReturnSettlement.findFirst({ where: { purchaseReturnId: returned.id } })
    const futurePurchase = await prisma.purchase.create({
      data: {
        tenantId: f.tenant.id, supplierId: supplier.id, invoiceNumber: `future-${randomUUID()}`,
        purchaseDate: new Date(), paymentType: 'CREDIT', total: 100, cashSessionId: f.cashSession.id,
        debt: { create: { tenantId: f.tenant.id, totalAmount: 100, balance: 100, status: 'PENDING' } },
      }, include: { debt: true },
    })
    const applicationResults = await Promise.allSettled([
      service.applySupplierCredit(credit.id, f.tenant.id, { purchaseId: futurePurchase.id, amount: 60 }),
      service.applySupplierCredit(credit.id, f.tenant.id, { purchaseId: futurePurchase.id, amount: 60 }),
    ])
    assert.equal(applicationResults.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(applicationResults.filter((result) => result.status === 'rejected').length, 1)
    const [updatedCredit, updatedDebt, applications] = await Promise.all([
      prisma.purchaseReturnSettlement.findUnique({ where: { id: credit.id } }),
      prisma.purchaseDebt.findUnique({ where: { id: futurePurchase.debt.id } }),
      prisma.purchaseReturnCreditApplication.findMany({ where: { settlementId: credit.id } }),
    ])
    assert.equal(Number(updatedCredit.appliedAmount), 60)
    assert.equal(updatedCredit.status, 'PARTIALLY_APPLIED')
    assert.equal(Number(updatedDebt.balance), 40)
    assert.equal(applications.reduce((sum, row) => sum + Number(row.amount), 0), 60)
    await assert.rejects(service.applySupplierCredit(credit.id, f.tenant.id, { purchaseId: futurePurchase.id, amount: 50 }), /supera el crédito disponible/)
  }))

test('failure after the first return stock movement rolls back the entire confirmation', () =>
  fixtureTest({ productCount: 2, stock: 5 }, async (f) => {
    const { supplier, purchase } = await createPurchaseWithItem(f, 5, { product: f.products[0] })
    await prisma.purchase.update({ where: { id: purchase.id }, data: { total: 200 } })
    const secondItem = await prisma.purchaseItem.create({
      data: { purchaseId: purchase.id, productId: f.products[1].id, quantity: 5, unitCost: 20, total: 100 },
    })
    assert.ok(supplier.id)
    const service = makePurchaseReturnService({
      $transaction: (callback, options) => prisma.$transaction(async (tx) => {
        let movementCount = 0
        const wrapped = new Proxy(tx, {
          get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver)
            if (property !== 'stockMovement') return value
            return new Proxy(value, {
              get(delegate, operation, movementReceiver) {
                const method = Reflect.get(delegate, operation, movementReceiver)
                if (operation !== 'create') return method
                return async (...args) => {
                  const created = await method.apply(delegate, args)
                  movementCount += 1
                  if (movementCount === 1) throw new Error('injected after stock movement')
                  return created
                }
              },
            })
          },
        })
        return callback(wrapped)
      }, options),
    })
    const returned = await service.create(f.tenant.id, createReturnDto(purchase, [
      { purchaseItemId: (await prisma.purchaseItem.findFirst({ where: { purchaseId: purchase.id, productId: f.products[0].id } })).id, quantity: 1 },
      { purchaseItemId: secondItem.id, quantity: 1 },
    ]))
    await assert.rejects(confirmReturn(service, returned, f.tenant.id), /injected after stock movement/)
    assert.equal((await prisma.purchaseReturn.findUnique({ where: { id: returned.id } })).status, 'PENDING')
    assert.deepEqual(await Promise.all(f.products.map(async (product) => Number((await prisma.product.findUnique({ where: { id: product.id } })).stock))), [5, 5])
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: returned.id } }), 0)
  }))

test('two concurrent sale returns cannot return the same sold unit twice', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const sales = makeSaleService().service
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const service = makeSaleReturnService()
    const makeReturn = () => service.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    })
    const first = await makeReturn()
    const second = await makeReturn()
    const outcomes = await Promise.allSettled([
      service.confirm(first.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' }),
      service.confirm(second.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' }),
    ])
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 5)
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: { in: [first.id, second.id] } } }), 1)
    assert.equal(await prisma.saleReturn.count({ where: { saleId: sale.id, status: 'CONFIRMED' } }), 1)
  }))

test('sale return racing with customer payment preserves either the debt offset or the real receipt', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const sales = makeSaleService().service
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT, customerId: f.customer.id,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const returns = makeSaleReturnService()
    const returned = await returns.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    })
    const outcomes = await Promise.allSettled([
      returns.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' }),
      makeCustomerPaymentService().payToAccount(f.tenant.id, {
        customerId: f.customer.id, amount: 100, paymentMethod: PaymentMethod.TRANSFER,
      }),
    ])
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1)
    const [customer, updatedSale, payment, confirmedReturn] = await Promise.all([
      prisma.customer.findUnique({ where: { id: f.customer.id } }),
      prisma.sale.findUnique({ where: { id: sale.id } }),
      prisma.customerPayment.findFirst({ where: { saleId: sale.id, isVoided: false } }),
      prisma.saleReturn.findUnique({ where: { id: returned.id }, include: { settlements: true, debtAdjustment: true } }),
    ])
    assert.equal(Number(customer.currentDebt), 0)
    assert.equal(confirmedReturn.status, 'CONFIRMED')
    if (payment) {
      assert.equal(Number(payment.amount), 100)
      assert.equal(Number(updatedSale.remainingBalance), 0)
      assert.equal(Number(confirmedReturn.debtOffsetAmount), 0)
      assert.equal(Number(confirmedReturn.settlements[0].amount), 100)
      assert.equal(confirmedReturn.debtAdjustment, null)
    } else {
      assert.equal(Number(updatedSale.remainingBalance), 0)
      assert.equal(Number(confirmedReturn.debtOffsetAmount), 100)
      assert.equal(confirmedReturn.settlements.length, 0)
      assert.ok(confirmedReturn.debtAdjustment)
      assert.equal(await prisma.saleReturnDebtAdjustment.count({ where: { saleReturnId: returned.id } }), 1)
    }
  }))

test('two simultaneous partial refund receipts serialize against one remaining balance', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const sales = makeSaleService().service
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT, customerId: f.customer.id, amountPaid: 100,
      initialPaymentMethod: PaymentMethod.TRANSFER,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const returns = makeSaleReturnService()
    const returned = await returns.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    })
    const confirmed = await returns.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' })
    const settlementId = confirmed.settlements[0].id
    const outcomes = await Promise.allSettled([
      returns.settleRefund(settlementId, f.tenant.id, f.user.id, { amount: 70, paymentMethod: 'TRANSFER' }),
      returns.settleRefund(settlementId, f.tenant.id, f.user.id, { amount: 70, paymentMethod: 'TRANSFER' }),
    ])
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1)
    const [settlement, receipts] = await Promise.all([
      prisma.saleReturnSettlement.findUnique({ where: { id: settlementId } }),
      prisma.saleReturnRefundReceipt.findMany({ where: { settlementId } }),
    ])
    assert.equal(settlement.status, 'PARTIALLY_SETTLED')
    assert.equal(receipts.length, 1)
    assert.equal(Number(receipts[0].amount), 70)
    assert.equal(await prisma.cashMovement.count({ where: { cashSessionId: f.cashSession.id } }), 0)
  }))

test('cash sale refund racing with close is either included in the snapshot or rejected', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const sales = makeSaleService().service
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const returns = makeSaleReturnService()
    const returned = await returns.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    })
    const confirmed = await returns.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' })
    const settlementId = confirmed.settlements[0].id
    const cash = new CashSessionService(prisma)
    const [refundResult, closeResult] = await Promise.allSettled([
      returns.settleRefund(settlementId, f.tenant.id, f.user.id, { amount: 50, paymentMethod: 'CASH' }),
      cash.close(f.tenant.id, f.cashSession.id, { closingAmount: 0 }),
    ])
    assert.equal(closeResult.status, 'fulfilled')
    const [closed, settlement, receipts, outflows] = await Promise.all([
      prisma.cashSession.findUnique({ where: { id: f.cashSession.id } }),
      prisma.saleReturnSettlement.findUnique({ where: { id: settlementId } }),
      prisma.saleReturnRefundReceipt.findMany({ where: { settlementId } }),
      prisma.cashMovement.aggregate({ where: { cashSessionId: f.cashSession.id, type: 'OUT' }, _sum: { amount: true } }),
    ])
    assert.equal(closed.status, 'CLOSED')
    if (refundResult.status === 'fulfilled') {
      assert.equal(receipts.length, 1)
      assert.equal(Number(outflows._sum.amount), 50)
      assert.equal(Number(closed.expectedAmount), 50)
      assert.equal(settlement.status, 'PARTIALLY_SETTLED')
    } else {
      assert.equal(receipts.length, 0)
      assert.equal(Number(outflows._sum.amount ?? 0), 0)
      assert.equal(Number(closed.expectedAmount), 100)
      assert.equal(settlement.status, 'PENDING')
    }
  }))

test('sale cancellation racing with its return leaves exactly one audited outcome', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const sales = makeSaleService().service
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT, customerId: f.customer.id,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const returns = makeSaleReturnService()
    const returned = await returns.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    })
    const outcomes = await Promise.allSettled([
      returns.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' }),
      sales.cancel(sale.id, f.tenant.id, f.user.id, 'Concurrent acceptance cancellation'),
    ])
    assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1)
    const [saleAfter, returnAfter, customer, product] = await Promise.all([
      prisma.sale.findUnique({ where: { id: sale.id } }),
      prisma.saleReturn.findUnique({ where: { id: returned.id } }),
      prisma.customer.findUnique({ where: { id: f.customer.id } }),
      prisma.product.findUnique({ where: { id: f.products[0].id } }),
    ])
    assert.equal(Number(customer.currentDebt), 0)
    assert.equal(Number(product.stock), 5)
    assert.ok((saleAfter.status === 'CANCELLED' && returnAfter.status === 'PENDING') ||
      (saleAfter.status === 'COMPLETED' && returnAfter.status === 'CONFIRMED'))
    assert.equal(await prisma.saleLifecycleEvent.count({ where: { saleId: sale.id } }), saleAfter.status === 'CANCELLED' ? 1 : 0)
  }))

test('failure after restocking a sale return rolls back stock, debt adjustment and settlement together', () =>
  fixtureTest({ stock: 5 }, async (f) => {
    const sales = makeSaleService().service
    const sale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT, customerId: f.customer.id, amountPaid: 50,
      initialPaymentMethod: PaymentMethod.TRANSFER,
      items: [{ productId: f.products[0].id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const createService = makeSaleReturnService()
    const returned = await createService.create(f.tenant.id, f.user.id, {
      saleId: sale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    })
    const failingService = makeSaleReturnService({
      $transaction: (callback, options) => prisma.$transaction(async (tx) => {
        const wrapped = new Proxy(tx, {
          get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver)
            if (property !== 'saleReturnDebtAdjustment') return value
            return new Proxy(value, {
              get(delegate, operation, adjustmentReceiver) {
                if (operation === 'create') return async () => { throw new Error('injected after sale return stock movement') }
                return Reflect.get(delegate, operation, adjustmentReceiver)
              },
            })
          },
        })
        return callback(wrapped)
      }, options),
    })
    await assert.rejects(
      failingService.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' }),
      /injected after sale return stock movement/,
    )
    assert.equal(Number((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock), 4)
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 50)
    assert.equal(Number((await prisma.sale.findUnique({ where: { id: sale.id } })).remainingBalance), 50)
    assert.equal((await prisma.saleReturn.findUnique({ where: { id: returned.id } })).status, 'PENDING')
    assert.equal(await prisma.stockMovement.count({ where: { referenceId: returned.id } }), 0)
    assert.equal(await prisma.saleReturnDebtAdjustment.count({ where: { saleReturnId: returned.id } }), 0)
    assert.equal(await prisma.saleReturnSettlement.count({ where: { saleReturnId: returned.id } }), 0)
  }))

test('commercial acceptance journey reconciles purchases, sales, returns, debt, drawer and next-session settlement', () =>
  fixtureTest({ productCount: 2, stock: 10, openingAmount: 500 }, async (f) => {
    const cash = new CashSessionService(prisma)
    const purchases = makePurchaseService()
    const debts = new PurchaseDebtService(prisma)
    const payments = makeCustomerPaymentService()
    const sales = makeSaleService().service
    const purchaseReturns = makePurchaseReturnService()
    const saleReturns = makeSaleReturnService()
    const supplier = await prisma.supplier.create({
      data: { tenantId: f.tenant.id, name: `Acceptance supplier ${randomUUID()}` },
    })
    let invoice = 1000000
    const purchase = async (product, quantity, unitCost, paymentType, debt) => purchases.create(
      f.tenant.id, f.cashSession.id, {
        supplierId: supplier.id,
        invoiceNumber: `001-001-${String(invoice++).padStart(7, '0')}`,
        purchaseDate: new Date().toISOString(),
        paymentType,
        total: quantity * unitCost,
        items: [{ productId: product.id, quantity, unitCost }],
        ...(debt ? { debt } : {}),
      },
    )
    const productA = f.products[0]
    const productB = f.products[1]
    const cashPurchase = await purchase(productA, 5, 20, 'CASH')
    const creditPurchase = await purchase(productB, 5, 40, 'CREDIT', {
      scheduleType: 'SUPPLIER_SCHEDULE',
      installments: [
        { number: 1, amount: 100, dueDate: '2026-11-15T00:00:00.000Z' },
        { number: 2, amount: 100, dueDate: '2026-12-15T00:00:00.000Z' },
      ],
    })
    assert.equal(await prisma.purchaseDebtInstallment.count({ where: { purchaseDebtId: creditPurchase.debt.id } }), 2)

    const cashSale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      items: [{ productId: productA.id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const transferSale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.TRANSFER,
      items: [{ productId: productA.id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    const creditSale = await sales.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      amountPaid: 20,
      initialPaymentMethod: PaymentMethod.TRANSFER,
      items: [{ productId: productB.id, quantity: 1, unitPrice: 100, priceType: PriceType.PUBLIC }],
    })
    await payments.payToAccount(f.tenant.id, { customerId: f.customer.id, amount: 30, paymentMethod: PaymentMethod.CASH })
    await debts.registerPayment(f.tenant.id, creditPurchase.id, {
      amount: 40, paymentMethod: 'CASH', cashSessionId: f.cashSession.id,
    })
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 50)
    assert.equal(Number((await prisma.purchaseDebt.findUnique({ where: { purchaseId: creditPurchase.id } })).balance), 160)

    const creditPurchaseReturn = await purchaseReturns.create(f.tenant.id, createReturnDto(creditPurchase, [
      { purchaseItemId: creditPurchase.items[0].id, quantity: 1 },
    ]))
    await purchaseReturns.confirm(creditPurchaseReturn.id, f.tenant.id)
    assert.equal(Number((await prisma.purchaseDebt.findUnique({ where: { purchaseId: creditPurchase.id } })).balance), 120)

    const cashPurchaseReturn = await purchaseReturns.create(f.tenant.id, createReturnDto(cashPurchase, [
      { purchaseItemId: cashPurchase.items[0].id, quantity: 5 },
    ]))
    await purchaseReturns.confirm(cashPurchaseReturn.id, f.tenant.id, { settlementDisposition: 'REFUND_PENDING' })
    const supplierRefund = await prisma.purchaseReturnSettlement.findFirst({ where: { purchaseReturnId: cashPurchaseReturn.id } })
    await purchaseReturns.settleRefund(supplierRefund.id, f.tenant.id, { amount: 40, paymentMethod: 'TRANSFER' })
    await purchaseReturns.settleRefund(supplierRefund.id, f.tenant.id, { amount: 60, paymentMethod: 'CASH' })
    assert.equal((await prisma.purchaseReturnSettlement.findUnique({ where: { id: supplierRefund.id } })).status, 'SETTLED')

    const paidCreditPurchase = await purchase(productA, 2, 25, 'CREDIT', {
      scheduleType: 'NONE', dueDate: '2026-11-20T00:00:00.000Z',
    })
    await debts.registerPayment(f.tenant.id, paidCreditPurchase.id, {
      amount: 50, paymentMethod: 'TRANSFER', cashSessionId: f.cashSession.id,
    })
    const creditReturn = await purchaseReturns.create(f.tenant.id, createReturnDto(paidCreditPurchase, [
      { purchaseItemId: paidCreditPurchase.items[0].id, quantity: 2 },
    ]))
    await purchaseReturns.confirm(creditReturn.id, f.tenant.id, { settlementDisposition: 'SUPPLIER_CREDIT' })
    const supplierCredit = await prisma.purchaseReturnSettlement.findFirst({ where: { purchaseReturnId: creditReturn.id } })
    const futureCreditPurchase = await purchase(productA, 2, 25, 'CREDIT', {
      scheduleType: 'NONE', dueDate: '2026-11-20T00:00:00.000Z',
    })
    await purchaseReturns.applySupplierCredit(supplierCredit.id, f.tenant.id, {
      purchaseId: futureCreditPurchase.id, amount: 30,
    })
    assert.equal(Number((await prisma.purchaseDebt.findUnique({ where: { purchaseId: futureCreditPurchase.id } })).balance), 20)
    assert.equal(Number((await prisma.purchaseReturnSettlement.findUnique({ where: { id: supplierCredit.id } })).appliedAmount), 30)

    const cashSaleReturn = await saleReturns.create(f.tenant.id, f.user.id, {
      saleId: cashSale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: cashSale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    })
    await saleReturns.confirm(cashSaleReturn.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' })
    const pendingSaleRefund = await prisma.saleReturnSettlement.findFirst({ where: { saleReturnId: cashSaleReturn.id } })

    const creditSaleReturn = await saleReturns.create(f.tenant.id, f.user.id, {
      saleId: creditSale.id, returnDate: new Date().toISOString(),
      items: [{ saleItemId: creditSale.items[0].id, quantity: 1, disposition: 'DAMAGED' }],
    })
    await saleReturns.confirm(creditSaleReturn.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' })
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 0)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: productB.id } })).stock), 13)
    assert.equal(Number((await prisma.sale.findUnique({ where: { id: creditSale.id } })).total), 100)
    assert.equal(Number((await prisma.sale.findUnique({ where: { id: transferSale.id } })).total), 100)
    await assert.rejects(
      saleReturns.settleRefund(pendingSaleRefund.id, f.tenant.id, f.user.id, { amount: 101, paymentMethod: 'TRANSFER' }),
      /supera el saldo pendiente|saldo pendiente/i,
    )
    await saleReturns.settleRefund(pendingSaleRefund.id, f.tenant.id, f.user.id, { amount: 40, paymentMethod: 'CASH' })
    const firstDay = await cash.findOne(f.tenant.id, f.cashSession.id)
    assert.equal(firstDay.status, 'OPEN')
    assert.equal(firstDay.expectedCashAmount, 510)
    const closed = await cash.close(f.tenant.id, f.cashSession.id, { closingAmount: 510 })
    assert.equal(closed.status, 'CLOSED')
    const historicalSnapshot = Number(closed.expectedAmount)
    const nextSession = await cash.open(f.tenant.id, f.user.id, { openingAmount: 25 })
    await saleReturns.settleRefund(pendingSaleRefund.id, f.tenant.id, f.user.id, {
      amount: 60, paymentMethod: 'TRANSFER', effectiveAt: new Date().toISOString(),
    })
    const [settledRefund, nextTotals, oldSession] = await Promise.all([
      prisma.saleReturnSettlement.findUnique({ where: { id: pendingSaleRefund.id } }),
      cash.findOne(f.tenant.id, nextSession.id),
      prisma.cashSession.findUnique({ where: { id: f.cashSession.id } }),
    ])
    assert.equal(settledRefund.status, 'SETTLED')
    assert.equal(Number(nextTotals.expectedCashAmount), 25)
    assert.equal(Number(oldSession.expectedAmount), historicalSnapshot)
    assert.equal(await prisma.saleReturnRefundReceipt.count({ where: { settlementId: pendingSaleRefund.id } }), 2)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: productA.id } })).stock), 11)
    assert.equal(Number((await prisma.product.findUnique({ where: { id: productB.id } })).stock), 13)
    const dashboard = await new DashboardService(prisma, cash).getStats(f.tenant.id)
    assert.equal(dashboard.billing.today, 300)
    assert.equal(dashboard.billing.todayReturns, 200)
    assert.equal(dashboard.billing.netToday, 100)
  }))

test('sale create replay returns the same sale without repeating stock or cash effects', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const { service } = makeSaleService()
    const dto = { paymentMethod: PaymentMethod.CASH, items: itemsFor(f.products, 2) }
    const first = await service.create(f.tenant.id, f.cashSession.id, dto, 'sale-retry-key')
    const replay = await service.create(f.tenant.id, f.cashSession.id, dto, 'sale-retry-key')
    assert.equal(replay.id, first.id)
    assert.equal(await prisma.sale.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock, 8)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).totalSales), 200)
    await assert.rejects(
      service.create(f.tenant.id, f.cashSession.id, { ...dto, items: itemsFor(f.products, 1) }, 'sale-retry-key'),
      /contenido diferente/i,
    )
  }))

test('concurrent sale retries with the same key overlap at PostgreSQL and commit one operation', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const { service } = makeSaleService()
    const key = 'sale-concurrent-retry-key'
    const dto = { paymentMethod: PaymentMethod.CASH, items: itemsFor(f.products, 2) }
    const held = await holdIdempotencyKey(f, 'SALE_CREATE', key)
    const attempts = Promise.all([
      service.create(f.tenant.id, f.cashSession.id, dto, key),
      service.create(f.tenant.id, f.cashSession.id, dto, key),
    ])
    try {
      assert.ok(await waitForIdempotencyLockWaits(2) >= 2, 'both inserts must overlap on the tenant/operation/key unique index')
    } finally {
      held.release()
    }
    await held.transaction
    const [first, replay] = await attempts
    assert.equal(first.id, replay.id)
    assert.equal(await prisma.sale.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock, 8)
    assert.equal(Number((await prisma.cashSession.findUnique({ where: { id: f.cashSession.id } })).totalSales), 200)
  }))

test('purchase create retry returns its original purchase and does not increment inventory twice', () =>
  fixtureTest({ stock: 2 }, async (f) => {
    const supplier = await createPurchaseSupplier(f)
    const service = makePurchaseService()
    const dto = purchaseDto(f, supplier, f.products[0], 3, 'CASH')
    const first = await service.create(f.tenant.id, f.cashSession.id, dto, 'purchase-retry-key')
    const replay = await service.create(f.tenant.id, f.cashSession.id, dto, 'purchase-retry-key')
    assert.equal(replay.id, first.id)
    assert.equal(await prisma.purchase.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal((await prisma.product.findUnique({ where: { id: f.products[0].id } })).stock, 5)
  }))

test('customer FIFO account payment replay does not reduce the customer debt twice', () =>
  fixtureTest({}, async (f) => {
    const { service } = makeSaleService()
    await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CREDIT,
      customerId: f.customer.id,
      items: itemsFor(f.products),
    })
    const payments = makeCustomerPaymentService()
    const dto = { customerId: f.customer.id, amount: 25, paymentMethod: PaymentMethod.CASH }
    const first = await payments.payToAccount(f.tenant.id, dto, 'customer-payment-retry-key')
    const replay = await payments.payToAccount(f.tenant.id, dto, 'customer-payment-retry-key')
    assert.deepEqual(replay.payments.map((payment) => payment.id), first.payments.map((payment) => payment.id))
    assert.equal(await prisma.customerPayment.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal(Number((await prisma.customer.findUnique({ where: { id: f.customer.id } })).currentDebt), 75)
    assert.equal((await cashTotals(f)).totalCashDebtPayments, 25)
  }))

test('supplier debt payment replay preserves a single payment and one debt reduction', () =>
  fixtureTest({}, async (f) => {
    const { purchase, debt } = await createSupplierDebt(f)
    const paymentService = new PurchaseDebtService(prisma)
    const dto = {
      amount: 25,
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString(),
      cashSessionId: f.cashSession.id,
    }
    const first = await paymentService.registerPayment(f.tenant.id, purchase.id, dto, 'supplier-payment-retry-key')
    const replay = await paymentService.registerPayment(f.tenant.id, purchase.id, dto, 'supplier-payment-retry-key')
    assert.equal(replay.id, first.id)
    assert.equal(replay.payments.length, 1)
    assert.equal(await prisma.purchaseDebtPayment.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal(Number((await prisma.purchaseDebt.findUnique({ where: { id: debt.id } })).balance), 75)
  }))

test('sale return create and partial refund replays return the original resources without repeated effects', () =>
  fixtureTest({ stock: 10 }, async (f) => {
    const { service } = makeSaleService()
    const sale = await service.create(f.tenant.id, f.cashSession.id, {
      paymentMethod: PaymentMethod.CASH,
      items: itemsFor(f.products),
    })
    const returns = makeSaleReturnService()
    const dto = {
      saleId: sale.id,
      returnDate: new Date().toISOString(),
      reason: 'Idempotency integration',
      items: [{ saleItemId: sale.items[0].id, quantity: 1, disposition: 'RESTOCKABLE' }],
    }
    const returned = await returns.create(f.tenant.id, f.user.id, dto, 'sale-return-create-key')
    assert.equal((await returns.create(f.tenant.id, f.user.id, dto, 'sale-return-create-key')).id, returned.id)
    await returns.confirm(returned.id, f.tenant.id, f.user.id, { settlementDisposition: 'REFUND_PENDING' })
    assert.equal((await returns.create(f.tenant.id, f.user.id, dto, 'sale-return-create-key')).status, 'CONFIRMED')
    const settlement = await prisma.saleReturnSettlement.findFirst({ where: { saleReturnId: returned.id } })
    const receipt = { amount: 40, paymentMethod: 'TRANSFER', effectiveAt: new Date().toISOString() }
    const first = await returns.settleRefund(settlement.id, f.tenant.id, f.user.id, receipt, 'sale-refund-settle-key')
    const replay = await returns.settleRefund(settlement.id, f.tenant.id, f.user.id, receipt, 'sale-refund-settle-key')
    assert.equal(replay.id, first.id)
    assert.equal(await prisma.saleReturnRefundReceipt.count({ where: { settlementId: settlement.id } }), 1)
    assert.equal(await prisma.saleReturn.count({ where: { tenantId: f.tenant.id } }), 1)
    assert.equal(await prisma.stockMovement.count({ where: { tenantId: f.tenant.id } }), 2)
  }))

test('purchase return creation replay does not create another pending return', () =>
  fixtureTest({ stock: 2 }, async (f) => {
    const { purchase, item } = await createPurchaseWithItem(f, 3)
    const returned = makePurchaseReturnService()
    const dto = {
      purchaseId: purchase.id,
      returnDate: new Date().toISOString(),
      reason: 'Idempotency integration',
      items: [{ purchaseItemId: item.id, quantity: 1 }],
    }
    const first = await returned.create(f.tenant.id, dto, f.user.id, 'purchase-return-create-key')
    const replay = await returned.create(f.tenant.id, dto, f.user.id, 'purchase-return-create-key')
    assert.equal(replay.id, first.id)
    assert.equal(await prisma.purchaseReturn.count({ where: { tenantId: f.tenant.id } }), 1)
  }))

async function main() {
  await prisma.$connect()
  const identity = await prisma.$queryRaw`
    SELECT current_database() AS database,
           inet_server_addr()::text AS server_address,
           current_setting('server_version_num') AS server_version
  `
  assert.equal(identity[0].database, expectedDatabase)
  assert.match(identity[0].server_version, /^16/)
  process.env.POSENGINE_LOG_SALE_PERFORMANCE = 'true'
  process.env.POSENGINE_ENABLE_PURCHASE_RETURNS = 'true'
  process.env.POSENGINE_ENABLE_PURCHASE_SETTLEMENTS = 'true'
  process.env.POSENGINE_ENABLE_SUPPLIER_CREDIT_APPLICATIONS = 'true'
  process.env.POSENGINE_ENABLE_SALE_RETURNS = 'true'
  process.env.POSENGINE_ENABLE_SALE_REFUNDS = 'true'
  process.env.POSENGINE_ENABLE_PURCHASE_CANCELLATIONS = 'true'
  process.env.POSENGINE_ENABLE_SALE_CANCELLATIONS = 'true'
  process.env.POSENGINE_ENABLE_SALE_RESTORATIONS = 'true'
  console.log(JSON.stringify({ event: 'postgres_test_target_verified', host: parsedUrl.hostname, port: parsedUrl.port, database: identity[0].database, postgresVersion: identity[0].server_version }))

  let failures = 0
  for (const entry of tests) {
    const startedAt = performance.now()
    try {
      await entry.run()
      console.log(`PASS ${entry.name} (${Math.round(performance.now() - startedAt)}ms)`)
    } catch (error) {
      failures += 1
      console.error(`FAIL ${entry.name}: ${error?.stack || error}`)
    }
  }
  console.log(`INTEGRATION_RESULT ${tests.length - failures}/${tests.length} passed`)
  console.log(`SALE_PERFORMANCE ${JSON.stringify(performanceResults)}`)
  await prisma.onModuleDestroy()
  if (failures) process.exitCode = 1
}

main().catch(async (error) => {
  console.error(`INTEGRATION_SETUP_FAILED ${error?.stack || error}`)
  try { await prisma.onModuleDestroy() } catch {}
  process.exitCode = 1
})
