import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app/app.module';
import { LatencyInterceptor } from './common/interceptors/latency.interceptor';
import { configureTrustProxy } from './common/utils/configure-trust-proxy.util';
import { configureHelmet } from './common/utils/configure-helmet.util';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);
  configureTrustProxy(app);
  configureHelmet(app);
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
  
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim());
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
  
  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(
    `📚 Swagger docs available at: http://localhost:${port}/${globalPrefix}/docs`,
  );
}

bootstrap();
