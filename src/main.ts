import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  const configService = app.get(ConfigService);

  const port = Number(configService.get<string>('PORT'));
  const frontendUrl = configService.get<string>('FRONTEND_URL');

  app.enableCors({
    origin: frontendUrl ?? 'http://localhost:5173',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept',
  });
  await app.listen(port ?? 3000);
}
bootstrap();
