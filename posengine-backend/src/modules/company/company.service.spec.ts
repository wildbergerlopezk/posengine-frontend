jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class PrismaService {} }))

import { BadRequestException } from '@nestjs/common'
import { CompanyService } from './company.service'
import { UploadService } from '../upload/upload.service'

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'
const STORAGE_ORIGIN = 'https://storage.example.test'
const filename = '33333333-3333-4333-8333-333333333333.webp'

describe('CompanyService logo ownership', () => {
  const previousUrl = process.env.SUPABASE_URL
  const previousKey = process.env.SUPABASE_SERVICE_KEY
  const prisma = {
    company: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  }
  const uploadService = new UploadService()
  const service = new CompanyService(prisma as any, uploadService)

  beforeEach(() => {
    process.env.SUPABASE_URL = STORAGE_ORIGIN
    process.env.SUPABASE_SERVICE_KEY = 'test-only-key'
    jest.clearAllMocks()
    prisma.company.findFirst.mockResolvedValue({ id: 'company-a', logoUrl: null })
    prisma.company.update.mockResolvedValue({ id: 'company-a' })
  })

  afterAll(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_KEY
    else process.env.SUPABASE_SERVICE_KEY = previousKey
  })

  const logoUrl = (tenantId: string) =>
    `${STORAGE_ORIGIN}/storage/v1/object/public/product-images/${tenantId}/${filename}`

  it('rejects assigning another tenant logo before writing company data', async () => {
    await expect(service.update('company-a', TENANT_A, {
      logoUrl: logoUrl(TENANT_B),
    } as any)).rejects.toBeInstanceOf(BadRequestException)

    expect(prisma.company.update).not.toHaveBeenCalled()
  })

  it('accepts an uploaded logo belonging to the authenticated tenant', async () => {
    await expect(service.update('company-a', TENANT_A, {
      logoUrl: logoUrl(TENANT_A),
    } as any)).resolves.toEqual({ id: 'company-a' })

    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'company-a' },
      data: { logoUrl: logoUrl(TENANT_A) },
    }))
  })

  it('allows retaining an unverifiable historical URL while updating other company fields', async () => {
    const historicalUrl = 'https://legacy.example/logo.png'
    prisma.company.findFirst.mockResolvedValue({ id: 'company-a', logoUrl: historicalUrl })

    await expect(service.update('company-a', TENANT_A, {
      logoUrl: historicalUrl,
      tradeName: 'Nombre actualizado',
    } as any)).resolves.toEqual({ id: 'company-a' })

    expect(prisma.company.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { logoUrl: historicalUrl, tradeName: 'Nombre actualizado' },
    }))
  })
})
