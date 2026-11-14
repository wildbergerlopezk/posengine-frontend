import { Module } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CompanyController } from './company.controller';
import { UploadModule } from '../upload/upload.module';

@Module({
  controllers: [CompanyController],
  imports: [UploadModule],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
