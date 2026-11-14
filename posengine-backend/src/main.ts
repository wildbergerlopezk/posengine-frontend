import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'
import { writeFileSync } from 'fs'
import { AllExceptionsFilter } from './common/filters/http-exception.filter'
import { Prisma } from './generated/prisma/client'

// Forzar a que los Decimal de Prisma se serialicen como números en JSON
;(Prisma.Decimal.prototype as any).toJSON = function () {
  return this.toNumber()
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`CORS bloqueado: ${origin}`))
    },
    credentials: true,
  })

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  app.useGlobalFilters(new AllExceptionsFilter())

  const config = new DocumentBuilder()
    .setTitle('PosEngine API')
    .setDescription('Documentación de la API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
      },
      'access-token',
    )
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, document)

  if (process.env.EXPORT_SWAGGER === 'true') {
    writeFileSync(
      join(process.cwd(), 'swagger-spec.json'),
      JSON.stringify(document, null, 2),
    )
    console.log('Swagger spec exported successfully to swagger-spec.json')
    await app.close()
    process.exit(0)
  }

  const port = Number(process.env.PORT) || 3006
  await app.listen(port, '0.0.0.0')

  console.log(`Backend corriendo en: http://localhost:${port}`)
  console.log(`Uploads: http://localhost:${port}/uploads`)
  console.log(`Swagger: http://localhost:${port}/api`)
}

bootstrap()
