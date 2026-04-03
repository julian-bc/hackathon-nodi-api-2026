import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import appConfig from '../config/app.config';
import databaseConfig from 'src/config/database.config';
import jwtConfig from 'src/config/jwt.config';
import { MongooseModule } from '@nestjs/mongoose';
import { validate } from 'src/config/env.validate';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';

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
    BullModule.forRoot({
      connection: { host: 'localhost', port: 6379 }
    }),
    NotificationsModule,
  ],
})
export class AppModule {}
