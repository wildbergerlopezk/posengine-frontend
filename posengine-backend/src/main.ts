import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? [
    'http://localhost:3000',
  ]

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin)) {
        callback(null, true)
      } else if (allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`CORS bloqueado: ${origin}`))
      }
    },
    credentials: true,
  })

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
        description: 'Ingresa el token JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3005;
  await app.listen(port, '0.0.0.0')

  console.log(`Servidor corriendo en: http://localhost:${port}`);
  console.log(`Servidor corriendo en: http://0.0.0.0:${port}`)
  console.log(`Swagger disponible en: http://localhost:${port}/api`);
}

void bootstrap();
