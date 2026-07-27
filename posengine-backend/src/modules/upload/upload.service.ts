import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const BUCKET = 'product-images'
const IS_DEV = process.env.NODE_ENV !== 'production'

@Injectable()
export class UploadService {
  private supabase: SupabaseClient | null = null

  private getClient(): SupabaseClient {
    if (!this.supabase) {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        throw new InternalServerErrorException(
          '[UploadService] Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el entorno'
        )
      }
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
      )
    }
    return this.supabase
  }

  async uploadFile(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Archivo requerido')

    // Mock en desarrollo sin credenciales (guardar localmente)
    if (IS_DEV && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)) {
      console.warn('[DEV] Supabase no configurado, guardando archivo localmente')
      const fs = require('fs')
      const path = require('path')
      const uploadsDir = path.join(process.cwd(), 'uploads')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
      
      const filename = `mock-${Date.now()}.webp`
      const optimized = await sharp(file.buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
        
      fs.writeFileSync(path.join(uploadsDir, filename), optimized)
      const port = process.env.PORT || '3006'
      return { url: `http://localhost:${port}/uploads/${filename}` }
    }

    const optimized = await sharp(file.buffer)
      .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`

    const { error } = await this.getClient()
      .storage
      .from(BUCKET)
      .upload(filename, optimized, { contentType: 'image/webp', upsert: false })

    if (error) throw new InternalServerErrorException(`Error al subir imagen: ${error.message}`)

    const { data } = this.getClient().storage.from(BUCKET).getPublicUrl(filename)
    return { url: data.publicUrl }
  }

  async deleteFile(filename: string): Promise<{ deleted: boolean }> {
    if (IS_DEV && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)) {
      console.warn('[DEV] Supabase no configurado, simulando delete')
      return { deleted: true }
    }

    const { error } = await this.getClient()
      .storage
      .from(BUCKET)
      .remove([filename])

    if (error) throw new InternalServerErrorException(`Error al eliminar imagen: ${error.message}`)

    return { deleted: true }
  }
}