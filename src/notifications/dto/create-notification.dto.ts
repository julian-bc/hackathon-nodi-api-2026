import { IsArray, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { NotificationChannel, NotificationType } from '../schema/notificacion.schema';

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels!: NotificationChannel[];

  // email del usuario para nodemailer
  @IsOptional()
  @IsString()
  email?: string;

  // número de WhatsApp ej: +573001234567
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}