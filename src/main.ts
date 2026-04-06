import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { Model } from 'mongoose';
import { User } from './user/schema/user.schema';
import { getModelToken } from '@nestjs/mongoose';
import { DocumentTypes, UserRoles } from './user/types/user.types';
import { HashService } from './common/hash/hash.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new GlobalExceptionFilter());
  const configService = app.get(ConfigService);

  const port = Number(configService.get<string>('PORT'));
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const adminPassword = configService.get<string>('ADMIN_PASSWORD');
  const adminEmail = configService.get<string>('ADMIN_EMAIL');

  if (!adminPassword || !adminEmail) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD son obligatorios');
  }

  app.enableCors({
    origin: frontendUrl ?? 'http://localhost:5173',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept',
  });
  app.use(cookieParser());

  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const hashService = app.get(HashService);

  await userModel.findOneAndUpdate(
    { email: adminEmail },
    {
      $setOnInsert: {
        name: 'ADMIN',
        age: 129,
        documentType: DocumentTypes.CC,
        documentNumber: 999999999,
        email: adminEmail,
        password: await hashService.hashPassword(adminPassword),
        phone: '3000000000',
        role: UserRoles.administrador,
        isEmailVerified: true,
        pendingEmail: null,
        emailChangeVerification: null,
        forgotPasswordVerification: null,
        registrationVerification: null,
      },
    },
    {
      upsert: true,
      new: true,
    },
  );

  await app.listen(port ?? 3000);
}
bootstrap();
