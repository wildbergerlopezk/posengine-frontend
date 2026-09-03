import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CategoryModule } from './modules/category/category.module';
import { SubcategoryModule } from './modules/subcategory/subcategory.module';
import { ProductModule } from './modules/product/product.module';
import { UploadModule } from './modules/upload/upload.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { SupplierModule } from './modules/supplier/supplier.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { SaleModule } from './modules/sale/sale.module';
import { StockMovementModule } from './modules/stock-movement/stock-movement.module';
import { CustomerModule } from './modules/customer/customer.module';
import { CustomerPaymentModule } from './modules/customer-payment/customer-payment.module';
import { CashSessionModule } from './modules/cash-session/cash-session.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { CompanyModule } from './modules/company/company.module';
import { InternalReceiptModule } from './modules/internal-receipts/internal-receipt.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MailModule } from './common/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    UserModule,
    AuthModule,
    MailModule,
    SubscriptionModule,
    CompanyModule,
    CategoryModule,
    SubcategoryModule,
    ProductModule,
    UploadModule,
    PurchaseModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    SupplierModule,
    SaleModule,
    StockMovementModule,
    CustomerModule,
    CustomerPaymentModule,
    CashSessionModule,
    InternalReceiptModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
