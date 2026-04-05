import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Notification, NotificationChannel, NotificationDocument } from './schema/notificacion.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private readonly configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async processNotification(data: CreateNotificationDto): Promise<void> {
    this.logger.log(`Procesando notificación para usuario ${data.userId}`);

    // 1. Guardar en DB
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
      from: `"Coraje S.A.S" <${this.configService.get('MAIL_USER')}>`,
      to: data.email,
      subject: data.title,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Arial, sans-serif;">
          
          <!-- Wrapper -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #1a73e8; border-radius: 8px 8px 0 0; padding: 30px 40px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 1px;">
                        Coraje S.A.S
                      </h1>
                      <p style="margin: 5px 0 0; color: #d0e4ff; font-size: 13px;">
                        Farmacia Principal — Sistema de Gestión
                      </p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="background-color: #ffffff; padding: 40px;">
                      
                      <!-- Título notificación -->
                      <h2 style="margin: 0 0 16px; color: #1a1a2e; font-size: 20px; font-weight: 600;">
                        ${data.title}
                      </h2>

                      <!-- Línea divisora -->
                      <hr style="border: none; border-top: 1px solid #e8ecf0; margin: 0 0 24px;">

                      <!-- Mensaje -->
                      <p style="margin: 0 0 24px; color: #4a5568; font-size: 15px; line-height: 1.7;">
                        ${data.message}
                      </p>

                      <!-- Caja de alerta -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background-color: #f0f7ff; border-left: 4px solid #1a73e8; border-radius: 4px; padding: 16px 20px;">
                            <p style="margin: 0; color: #1a73e8; font-size: 13px; font-weight: 600;">
                              📋 Este es un mensaje automático del sistema de gestión de medicamentos.
                            </p>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; border-top: 1px solid #e8ecf0; border-radius: 0 0 8px 8px; padding: 24px 40px; text-align: center;">
                      <p style="margin: 0 0 8px; color: #718096; font-size: 12px;">
                        © 2026 Coraje S.A.S — Todos los derechos reservados
                      </p>
                      <p style="margin: 0; color: #a0aec0; font-size: 11px;">
                        Si no esperabas este correo, puedes ignorarlo con seguridad.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>

        </body>
        </html>
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
        } as HeadersInit,
        body: JSON.stringify({
          number: data.phone,
          message: `*${data.title}*\n${data.message}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error((error as { error?: string }).error ?? 'Error desconocido del bot');
      }

      this.logger.log(`WhatsApp enviado a ${data.phone}`);
    } catch (err) {
      this.logger.error(`Error enviando WhatsApp: ${(err as Error).message}`);
    }
  }
}