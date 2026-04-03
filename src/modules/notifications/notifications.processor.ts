import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Notification, NotificationChannel, NotificationDocument } from './schema/notificacion.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Processor('notifications')
@Injectable()
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private readonly configService: ConfigService,
  ) {
    super();

    // Nodemailer
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async process(job: Job<CreateNotificationDto>): Promise<void> {
    const data = job.data;
    this.logger.log(`Procesando notificación [${job.name}] para usuario ${data.userId}`);

    // 1. Guardar en DB (in-app siempre)
    await this.notificationModel.create({
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      channels: data.channels,
      metadata: data.metadata ?? {},
      read: false,
    });

    // 2. Enviar email si aplica
    if (data.channels.includes(NotificationChannel.EMAIL) && data.email) {
      await this.sendEmail(data);
    }

    // 3. Enviar WhatsApp si aplica
    if (data.channels.includes(NotificationChannel.WHATSAPP) && data.phone) {
      await this.sendWhatsApp(data);
    }
  }

  private async sendEmail(data: CreateNotificationDto): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"MediTrack" <${this.configService.get('MAIL_USER')}>`,
        to: data.email,
        subject: data.title,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>${data.title}</h2>
            <p>${data.message}</p>
          </div>
        `,
      });
      this.logger.log(`Email enviado a ${data.email}`);
    } catch (err) {
      this.logger.error(`Error enviando email: ${(err as Error).message}`);
    }
  }

  private async sendWhatsApp(data: CreateNotificationDto): Promise<void> {
    try {
      const botUrl = this.configService.get<string>('WHATSAPP_BOT_URL');
      const apiKey = this.configService.get<string>('WHATSAPP_BOT_API_KEY') ?? '';

      const response = await fetch(`${botUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          number: data.phone,   // ej: 573001234567
          message: `*${data.title}*\n${data.message}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? 'Error desconocido del bot');
      }

      this.logger.log(`WhatsApp enviado a ${data.phone}`);
    } catch (err) {
      this.logger.error(`Error enviando WhatsApp: ${(err as Error).message}`);
    }
  }
}