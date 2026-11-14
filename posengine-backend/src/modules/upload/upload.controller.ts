import {
  Controller,
  Post,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger'
import { UploadService } from './upload.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { UserRole } from '../../generated/prisma/enums'

@ApiTags('Upload')
@ApiBearerAuth('access-token')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a product image',
    description:
      'Accepts JPEG, PNG or WebP. The image is resized to 800×800 and converted to WebP before being stored in Supabase Storage.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG or WebP, max 5 MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded and optimized successfully',
    schema: { example: { url: 'https://xyz.supabase.co/storage/v1/object/public/product-images/1234567890.webp' } },
  })
  @ApiResponse({ status: 400, description: 'No file provided or invalid format' })
  @ApiResponse({ status: 500, description: 'Supabase storage error' })
  async upload(
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploadService.uploadFile(tenantId, file)
  }

  @Delete(':filename')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a product image',
    description: 'Removes an image uploaded by the authenticated tenant.',
  })
  @ApiParam({
    name: 'filename',
    description: 'Filename returned by the upload endpoint',
    example: '123e4567-e89b-42d3-a456-426614174000.webp',
  })
  @ApiResponse({ status: 200, description: 'Image deleted successfully', schema: { example: { deleted: true } } })
  @ApiResponse({ status: 500, description: 'Supabase storage error' })
  async remove(
    @Param('filename') filename: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.uploadService.deleteFile(tenantId, filename)
  }
}
