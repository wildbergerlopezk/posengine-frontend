import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Delete,
  Param,
  InternalServerErrorException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { extname } from 'path'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

const BUCKET = 'product-images'

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo requerido')
    }

    const optimized = await sharp(file.buffer)
      .resize(800, 800, {
        fit: 'inside',       
        withoutEnlargement: true,
      })
      .webp({ quality: 80 }) 
      .toBuffer()

    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const filename = `${unique}.webp`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, optimized, {
        contentType: 'image/webp',
        upsert: false,
      })

    if (error) {
      throw new InternalServerErrorException(`Error al subir imagen: ${error.message}`)
    }

    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filename)

    return { url: data.publicUrl }
  }

  @Delete(':filename')
  async remove(@Param('filename') filename: string) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([filename])

    if (error) {
      throw new InternalServerErrorException(`Error al eliminar imagen: ${error.message}`)
    }

    return { deleted: true }
  }
}