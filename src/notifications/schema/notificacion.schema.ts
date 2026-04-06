import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

export enum NotificationType {
  // Estados de medicamento (para pacientes/cuidadores)
  MEDICINE_ACTIVE = 'MEDICINE_ACTIVE',       // DISPONIBLE
  MEDICINE_OUT_OF_STOCK = 'MEDICINE_OUT_OF_STOCK', // AGOTADO
  MEDICINE_LOW_STOCK = 'MEDICINE_LOW_STOCK',       // BAJO STOCK

  // Para trabajadores/admins
  STOCK_LOW_ALERT = 'STOCK_LOW_ALERT',
  STOCK_EMPTY_ALERT = 'STOCK_EMPTY_ALERT',
  STOCK_ACTIVE_ALERT = 'STOCK_ACTIVE_ALERT',
  TURN_REMINDER = 'TURN_REMINDER',

  // Tickets
  TICKET_READY = 'TICKET_READY',
}

// Notificaciones
export enum NotificationChannel {
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  IN_APP = 'IN_APP',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true })
  userId!: string;

  @Prop({ type: String, default: null })
  recipientName!: string | null;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ enum: NotificationType, required: true })
  type!: NotificationType;

  @Prop({ enum: NotificationChannel, type: [String], default: [NotificationChannel.IN_APP] })
  channels!: NotificationChannel[];

  @Prop({ default: false })
  read!: boolean;

  @Prop({ type: Date, default: null })
  readAt!: Date | null;

  // metadata extra: medicineId, ticketId, etc.
  @Prop({ type: Object, default: {} })
  metadata!: Record<string, any>;
}


export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, read: 1 });