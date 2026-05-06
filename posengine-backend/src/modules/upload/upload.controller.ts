import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Delete,
  Param,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import * as fs from 'fs'
import { join } from 'path'

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Archivo requerido')
    }

    return {
      url: `/uploads/${file.filename}`,
    }
  }

  @Delete(':filename')
  remove(@Param('filename') filename: string) {
    const filePath = join(process.cwd(), 'uploads', filename)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    return { deleted: true }
  }
}