import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const BUCKET = 'product-images'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGE_PIXELS = 25_000_000
const IMAGE_FETCH_TIMEOUT_MS = 5_000
const TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ASSET_FILENAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i
const ALLOWED_IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp'])
const IS_DEV = process.env.NODE_ENV !== 'production'

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name)
  private supabase: SupabaseClient | null = null

  private hasSupabaseConfig() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  }

  private assertTenantId(tenantId: string) {
    if (!tenantId || !TENANT_ID_PATTERN.test(tenantId)) {
      throw new BadRequestException('Contexto de empresa inválido')
    }
  }

  private getClient(): SupabaseClient {
    if (!this.supabase) {
      const baseUrl = process.env.SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_KEY
      if (!baseUrl || !serviceKey) {
        throw new InternalServerErrorException('El almacenamiento de archivos no está disponible')
      }
      this.supabase = createClient(baseUrl, serviceKey)
    }
    return this.supabase
  }

  private getSupabaseOrigin() {
    const rawUrl = process.env.SUPABASE_URL
    if (!rawUrl) throw new InternalServerErrorException('El almacenamiento de archivos no está disponible')

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      throw new InternalServerErrorException('El almacenamiento de archivos no está disponible')
    }
    if (url.protocol !== 'https:' && !(IS_DEV && url.protocol === 'http:')) {
      throw new InternalServerErrorException('El almacenamiento de archivos no está disponible')
    }
    return url.origin
  }

  private getOwnedStorageKey(tenantId: string, assetUrl: string): string {
    this.assertTenantId(tenantId)

    let parsed: URL
    try {
      parsed = new URL(assetUrl)
    } catch {
      throw new BadRequestException('El archivo no pertenece a la empresa actual')
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new BadRequestException('El archivo no pertenece a la empresa actual')
    }

    let key: string | null = null
    if (IS_DEV && !this.hasSupabaseConfig()) {
      const port = process.env.PORT || '3006'
      if (parsed.origin !== `http://localhost:${port}` || parsed.protocol !== 'http:') {
        throw new BadRequestException('El archivo no pertenece a la empresa actual')
      }
      const prefix = `/uploads/${tenantId}/`
      if (parsed.pathname.startsWith(prefix)) key = parsed.pathname.slice(prefix.length)
    } else {
      if (parsed.origin !== this.getSupabaseOrigin() || parsed.protocol !== 'https:' && !(IS_DEV && parsed.protocol === 'http:')) {
        throw new BadRequestException('El archivo no pertenece a la empresa actual')
      }
      const prefix = `/storage/v1/object/public/${BUCKET}/${tenantId}/`
      if (parsed.pathname.startsWith(prefix)) key = `${tenantId}/${parsed.pathname.slice(prefix.length)}`
    }

    if (!key) throw new BadRequestException('El archivo no pertenece a la empresa actual')
    const parts = key.split('/')
    const filename = parts.at(-1)
    if (
      parts.length !== 2 ||
      parts[0] !== tenantId ||
      !filename ||
      !ASSET_FILENAME_PATTERN.test(filename)
    ) {
      throw new BadRequestException('El archivo no pertenece a la empresa actual')
    }
    return key
  }

  async assertOwnedLogoUrl(tenantId: string, assetUrl: string) {
    this.getOwnedStorageKey(tenantId, assetUrl)
  }

  async assertOwnedAssetIfManaged(tenantId: string, assetUrl: string) {
    let parsed: URL
    try {
      parsed = new URL(assetUrl)
    } catch {
      return
    }
    const localOrigin = `http://localhost:${process.env.PORT || '3006'}`
    const isManaged =
      (this.hasSupabaseConfig() && parsed.origin === this.getSupabaseOrigin()) ||
      (IS_DEV && !this.hasSupabaseConfig() && parsed.origin === localOrigin && parsed.pathname.startsWith('/uploads/'))
    if (isManaged) this.getOwnedStorageKey(tenantId, assetUrl)
  }

  async uploadFile(tenantId: string, file: Express.Multer.File): Promise<{ url: string }> {
    this.assertTenantId(tenantId)
    if (!file?.buffer?.length) throw new BadRequestException('Archivo requerido')
    if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('La imagen supera el tamaño permitido')
    }

    let optimized: Buffer
    try {
      const image = sharp(file.buffer, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' })
      const metadata = await image.metadata()
      if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) {
        throw new BadRequestException('Formato de imagen inválido')
      }
      optimized = await image
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throw new BadRequestException('El contenido no es una imagen válida')
    }

    const filename = `${randomUUID()}.webp`
    const key = `${tenantId}/${filename}`

    if (IS_DEV && !this.hasSupabaseConfig()) {
      const directory = path.join(process.cwd(), 'uploads', tenantId)
      await fs.mkdir(directory, { recursive: true })
      await fs.writeFile(path.join(directory, filename), optimized, { flag: 'wx' })
      const port = process.env.PORT || '3006'
      return { url: `http://localhost:${port}/uploads/${key}` }
    }

    const { error } = await this.getClient()
      .storage
      .from(BUCKET)
      .upload(key, optimized, { contentType: 'image/webp', upsert: false })
    if (error) throw new InternalServerErrorException('No se pudo guardar la imagen')

    const { data } = this.getClient().storage.from(BUCKET).getPublicUrl(key)
    return { url: data.publicUrl }
  }

  async deleteFile(tenantId: string, filename: string): Promise<{ deleted: boolean }> {
    this.assertTenantId(tenantId)
    if (!ASSET_FILENAME_PATTERN.test(filename)) {
      throw new NotFoundException('Archivo no encontrado')
    }
    const key = `${tenantId}/${filename}`

    if (IS_DEV && !this.hasSupabaseConfig()) {
      const filePath = path.resolve(process.cwd(), 'uploads', tenantId, filename)
      const uploadsRoot = path.resolve(process.cwd(), 'uploads') + path.sep
      if (!filePath.startsWith(uploadsRoot)) throw new NotFoundException('Archivo no encontrado')
      try {
        const info = await fs.lstat(filePath)
        if (!info.isFile() || info.isSymbolicLink()) throw new NotFoundException('Archivo no encontrado')
        await fs.unlink(filePath)
        return { deleted: true }
      } catch (error) {
        if (error instanceof NotFoundException) throw error
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new NotFoundException('Archivo no encontrado')
        }
        throw error
      }
    }

    const { data, error } = await this.getClient().storage.from(BUCKET).remove([key])
    if (error) throw new InternalServerErrorException('No se pudo eliminar la imagen')
    if (!data?.length) throw new NotFoundException('Archivo no encontrado')
    return { deleted: true }
  }

  async deleteOwnedAssetByUrl(tenantId: string, assetUrl: string): Promise<boolean> {
    let key: string
    try {
      key = this.getOwnedStorageKey(tenantId, assetUrl)
    } catch {
      // Historical root-level uploads have no verifiable owner; leave them untouched.
      return false
    }
    const filename = key.slice(tenantId.length + 1)
    try {
      await this.deleteFile(tenantId, filename)
      return true
    } catch (error) {
      if (error instanceof NotFoundException) return false
      this.logger.warn('No se pudo limpiar un archivo reemplazado; se conserva en el almacenamiento.')
      return false
    }
  }

  async getCompanyLogo(tenantId: string, assetUrl: string): Promise<Buffer | null> {
    try {
      const key = this.getOwnedStorageKey(tenantId, assetUrl)
      let source: Buffer
      if (IS_DEV && !this.hasSupabaseConfig()) {
        const filePath = path.resolve(process.cwd(), 'uploads', key)
        const uploadsRoot = path.resolve(process.cwd(), 'uploads') + path.sep
        if (!filePath.startsWith(uploadsRoot)) throw new Error('invalid_path')
        const info = await fs.lstat(filePath)
        if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_IMAGE_BYTES) {
          throw new Error('invalid_file')
        }
        source = await fs.readFile(filePath)
      } else {
        source = await this.downloadOwnedLogo(key)
      }

      const metadata = await sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' }).metadata()
      if (metadata.format !== 'webp') throw new Error('invalid_image')
      // Decode and normalize in a bounded raster format before embedding it in jsPDF.
      return await sharp(source, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'error' })
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
    } catch {
      this.logger.warn('No se usó el logo del comprobante: archivo no válido, inaccesible o sin propiedad verificable.')
      return null
    }
  }

  private async downloadOwnedLogo(key: string): Promise<Buffer> {
    const origin = this.getSupabaseOrigin()
    const objectUrl = new URL(`/storage/v1/object/public/${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`, origin)
    const response = await fetch(objectUrl, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error('storage_response')

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (contentType !== 'image/webp') throw new Error('invalid_content_type')
    const declaredLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) throw new Error('image_too_large')
    if (!response.body) throw new Error('empty_response')

    const reader = response.body.getReader()
    const chunks: Buffer[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel()
        throw new Error('image_too_large')
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, total)
  }
}
