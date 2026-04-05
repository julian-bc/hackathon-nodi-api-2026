import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationCodeEmail(
    to: string,
    code: string,
    type: 'registration' | 'email-change' | 'forgot-password',
  ): Promise<void> {
    const templates = {
      registration: {
        subject: 'Código de verificación de cuenta',
        title: '✅ Verificación de cuenta',
      },
      'email-change': {
        subject: 'Código de verificación de cambio de correo',
        title: '🔄 Cambio de correo electrónico',
      },
      'forgot-password': {
        subject: 'Código de recuperación de contraseña',
        title: '🔐 Recuperación de contraseña',
      },
    } as const;

    const { subject, title } = templates[type];

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
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

              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <h2 style="margin: 0 0 16px; color: #1a1a2e; font-size: 20px; font-weight: 600;">
                    ${title}
                  </h2>

                  <hr style="border: none; border-top: 1px solid #e8ecf0; margin: 0 0 24px;">

                  <p style="margin: 0 0 24px; color: #4a5568; font-size: 15px; line-height: 1.7;">
                    Tu código de verificación es:
                  </p>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 0 0 24px;">
                        <div style="display: inline-block; background-color: #f0f7ff; border: 2px dashed #1a73e8; border-radius: 8px; padding: 20px 40px;">
                          <span style="font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #1a73e8;">
                            ${code}
                          </span>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color: #fff8f0; border-left: 4px solid #f6a623; border-radius: 4px; padding: 16px 20px;">
                        <p style="margin: 0; color: #b45309; font-size: 13px; font-weight: 600;">
                          ⏳ Este código expira en 10 minutos. No lo compartas con nadie.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="background-color: #f8fafc; border-top: 1px solid #e8ecf0; border-radius: 0 0 8px 8px; padding: 24px 40px; text-align: center;">
                  <p style="margin: 0 0 8px; color: #718096; font-size: 12px;">
                    © 2026 Coraje S.A.S — Todos los derechos reservados
                  </p>
                  <p style="margin: 0; color: #a0aec0; font-size: 11px;">
                    Si no solicitaste este código, puedes ignorarlo con seguridad.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

    await this.mailerService.sendMail({
      to,
      subject,
      html,
    });
  }
}
