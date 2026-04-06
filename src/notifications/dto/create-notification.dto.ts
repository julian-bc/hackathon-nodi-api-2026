import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationChannel, NotificationType } from '../schema/notificacion.schema';

export class NotificationMetadataDto {
  @IsOptional()
  @IsString()
  medicineId?: string;

  @IsOptional()
  @IsString()
  ticketId?: string;
}

export class CreateNotificationDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

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
  @ValidateNested()
  @Type(() => NotificationMetadataDto)
  metadata?: NotificationMetadataDto;
}