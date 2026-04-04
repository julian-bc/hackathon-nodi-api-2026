import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import appConfig from '../config/app.config';
import databaseConfig from 'src/config/database.config';
import jwtConfig from 'src/config/jwt.config';
import { MongooseModule } from '@nestjs/mongoose';
import { validate } from 'src/config/env.validate';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { MedicationModule } from 'src/medication/medication.module';
import { UserModule } from 'src/user/user.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      cache: true,
      validate,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
    }),
    NotificationsModule,
    MedicationModule,
    UserModule,
    AuthModule,
  ],
})
export class AppModule {}
