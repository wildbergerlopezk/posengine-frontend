import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? [
    'http://localhost:3000',
  ]

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)

      const isLocalNetwork = /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)
      const isAllowed = allowedOrigins.includes(origin)

      if (isLocalNetwork || isAllowed) {
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

  const port = Number(process.env.PORT) || 3006
  await app.listen(port, '0.0.0.0')

  console.log(`Backend corriendo en: http://localhost:${port}`)
  console.log(`Uploads: http://localhost:${port}/uploads`)
  console.log(`Swagger: http://localhost:${port}/api`)
}

bootstrap()