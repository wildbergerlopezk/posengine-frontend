import { BadRequestException, NotFoundException } from '@nestjs/common'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { UploadService } from './upload.service'
import { UploadController } from './upload.controller'
import { ROLES_KEY } from '../../common/decorators/roles.decorator'
import { UserRole } from '../../generated/prisma/enums'
import { ForbiddenException } from '@nestjs/common'
import { RolesGuard } from '../auth/guards/roles.guard'

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'
const STORAGE_ORIGIN = 'https://storage.example.test'

describe('UploadService tenant-scoped storage', () => {
  const originalEnv = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_SERVICE_KEY,
    port: process.env.PORT,
  }
  const originalFetch = global.fetch
  let service: UploadService
  let tempDirectory: string
  let cwdSpy: jest.SpyInstance

  beforeEach(async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_KEY
    process.env.PORT = '3006'
    global.fetch = jest.fn()
    tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'posengine-upload-test-'))
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(tempDirectory)
    service = new UploadService()
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined)
  })

  afterEach(async () => {
    cwdSpy.mockRestore()
    global.fetch = originalFetch
    await fs.rm(tempDirectory, { recursive: true, force: true })
    if (originalEnv.supabaseUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalEnv.supabaseUrl
    if (originalEnv.supabaseKey === undefined) delete process.env.SUPABASE_SERVICE_KEY
    else process.env.SUPABASE_SERVICE_KEY = originalEnv.supabaseKey
    if (originalEnv.port === undefined) delete process.env.PORT
    else process.env.PORT = originalEnv.port
  })

  function storageUrl(tenantId: string, filename = '33333333-3333-4333-8333-333333333333.webp') {
    return `${STORAGE_ORIGIN}/storage/v1/object/public/product-images/${tenantId}/${filename}`
  }

  it('scopes new local uploads to the authenticated tenant and validates image content', async () => {
    const source = await sharp({
      create: { width: 3, height: 3, channels: 3, background: '#17803d' },
    }).png().toBuffer()
    const uploaded = await service.uploadFile(TENANT_A, {
      buffer: source,
      size: source.length,
      mimetype: 'image/png',
    } as Express.Multer.File)
    const filename = uploaded.url.split('/').at(-1)!
    const storedPath = path.join(tempDirectory, 'uploads', TENANT_A, filename)

    expect(uploaded.url).toMatch(new RegExp(`/uploads/${TENANT_A}/[0-9a-f-]+\\.webp$`))
    expect((await fs.stat(storedPath)).isFile()).toBe(true)
    await expect(service.deleteFile(TENANT_B, filename)).rejects.toBeInstanceOf(NotFoundException)
    expect((await fs.stat(storedPath)).isFile()).toBe(true)
    await expect(service.deleteFile(TENANT_A, filename)).resolves.toEqual({ deleted: true })
    await expect(fs.stat(storedPath)).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(service.deleteFile(TENANT_A, filename)).rejects.toBeInstanceOf(NotFoundException)
    await expect(service.getCompanyLogo(TENANT_A, uploaded.url)).resolves.toBeNull()
  })

  it('rejects invalid image payloads and filenames without a verifiable owner', async () => {
    await expect(service.uploadFile(TENANT_A, {
      buffer: Buffer.from('not an image'),
      size: 12,
      mimetype: 'image/png',
    } as Express.Multer.File)).rejects.toBeInstanceOf(BadRequestException)
    const oversizedImage = Buffer.alloc(5 * 1024 * 1024 + 1)
    await expect(service.uploadFile(TENANT_A, {
      buffer: oversizedImage,
      size: oversizedImage.length,
      mimetype: 'image/png',
    } as Express.Multer.File)).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.deleteFile(TENANT_A, 'legacy-root-file.webp'))
      .rejects.toBeInstanceOf(NotFoundException)
    await expect(service.deleteFile(TENANT_A, '../33333333-3333-4333-8333-333333333333.webp'))
      .rejects.toBeInstanceOf(NotFoundException)
  })

  it.each([
    'http://127.0.0.1:3006/uploads/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.webp',
    'http://localhost:3006/internal-service',
    'http://10.0.0.8/logo.webp',
    'http://169.254.169.254/latest/meta-data/',
    'ftp://storage.example.test/storage/v1/object/public/product-images/11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.webp',
    'https://storage.example.test/storage/v1/object/public/product-images/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.webp',
  ])('does not request untrusted or foreign logo destination %s', async (url) => {
    process.env.SUPABASE_URL = STORAGE_ORIGIN
    process.env.SUPABASE_SERVICE_KEY = 'test-only-key'
    await expect(service.getCompanyLogo(TENANT_A, url)).resolves.toBeNull()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not follow redirects from an owned storage object', async () => {
    process.env.SUPABASE_URL = STORAGE_ORIGIN
    process.env.SUPABASE_SERVICE_KEY = 'test-only-key'
    ;(global.fetch as jest.Mock).mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    }))

    await expect(service.getCompanyLogo(TENANT_A, storageUrl(TENANT_A))).resolves.toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith(
      new URL(storageUrl(TENANT_A)),
      expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }),
    )
  })

  it('limits response size and times out slow storage responses', async () => {
    process.env.SUPABASE_URL = STORAGE_ORIGIN
    process.env.SUPABASE_SERVICE_KEY = 'test-only-key'
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(new Response(null, {
      status: 200,
      headers: { 'content-type': 'image/webp', 'content-length': String(5 * 1024 * 1024 + 1) },
    }))
    await expect(service.getCompanyLogo(TENANT_A, storageUrl(TENANT_A))).resolves.toBeNull()

    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
    await expect(service.getCompanyLogo(TENANT_A, storageUrl(TENANT_A))).resolves.toBeNull()
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('accepts an owned logo, validates its bytes, and rejects non-image responses', async () => {
    process.env.SUPABASE_URL = STORAGE_ORIGIN
    process.env.SUPABASE_SERVICE_KEY = 'test-only-key'
    const webp = await sharp({
      create: { width: 3, height: 3, channels: 3, background: '#17803d' },
    }).webp().toBuffer()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(new Response(webp, {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    }))

    const logo = await service.getCompanyLogo(TENANT_A, storageUrl(TENANT_A))
    expect(logo).not.toBeNull()
    expect(await sharp(logo!).metadata()).toMatchObject({ format: 'png', width: 3, height: 3 })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(new Response('not an image', {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    }))
    await expect(service.getCompanyLogo(TENANT_A, storageUrl(TENANT_A))).resolves.toBeNull()
  })

  it('keeps historical unscoped files unavailable and prevents cross-tenant logo assignment', async () => {
    process.env.SUPABASE_URL = STORAGE_ORIGIN
    process.env.SUPABASE_SERVICE_KEY = 'test-only-key'
    await expect(service.assertOwnedLogoUrl(TENANT_A, storageUrl(TENANT_B)))
      .rejects.toBeInstanceOf(BadRequestException)
    await expect(service.getCompanyLogo(TENANT_A,
      `${STORAGE_ORIGIN}/storage/v1/object/public/product-images/legacy.webp`))
      .resolves.toBeNull()
    await expect(service.assertOwnedAssetIfManaged(TENANT_A, storageUrl(TENANT_B)))
      .rejects.toBeInstanceOf(BadRequestException)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('requires an administrator role for both upload and delete routes', () => {
    for (const method of ['upload', 'remove']) {
      expect(Reflect.getMetadata(ROLES_KEY, UploadController.prototype[method as keyof UploadController]))
        .toEqual([UserRole.ADMIN, UserRole.SUPERADMIN])
    }

    const handler = UploadController.prototype.remove
    const reflector = {
      getAllAndOverride: () => false,
      get: () => [UserRole.ADMIN, UserRole.SUPERADMIN],
    }
    const context = (role: string | undefined) => ({
      getHandler: () => handler,
      getClass: () => UploadController,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    })
    const guard = new RolesGuard(reflector as any)
    expect(guard.canActivate(context(UserRole.ADMIN) as any)).toBe(true)
    expect(() => guard.canActivate(context('UNAUTHORIZED_ROLE') as any)).toThrow(ForbiddenException)
    expect(() => guard.canActivate(context(undefined) as any)).toThrow(ForbiddenException)
  })
})
