/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { AppModule } from './app/app.module';
import { LatencyInterceptor } from './common/interceptors/latency.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  
  app.useGlobalInterceptors(new LatencyInterceptor());
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  
  const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()) ?? ['http://localhost:4200'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('MuixerApp API')
    .setDescription('API per a gestió d\'assistència i figures de muixerangues')
    .setVersion('1.0')
    .addTag('auth', 'Autenticació i gestió de sessions')
    .addTag('persons', 'Gestió de membres')
    .addTag('positions', 'Posicions de figures muixerangueres')
    .addTag('events', 'Esdeveniments: assajos i actuacions')
    .addTag('seasons', 'Temporades')
    .addTag('sync', 'Sincronització des del sistema legacy APPsistència')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(
    `📚 Swagger docs available at: http://localhost:${port}/${globalPrefix}/docs`,
  );
}

bootstrap();
