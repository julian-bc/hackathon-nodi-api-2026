import { MailerService } from '@nestjs-modules/mailer';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    await this.mailerService.sendMail({
      to,
      subject,
      html,
    });
  }

  async sendVerificationCodeEmail(
    to: string,
    code: string,
    type: 'registration' | 'email-change',
  ): Promise<void> {
    const subject =
      type === 'registration'
        ? 'Account verification code'
        : 'Email change verification code';

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${subject}</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">
          ${code}
        </div>
        <p>This code expires in 10 minutes.</p>
      </div>
    `;

    await this.mailerService.sendMail({
      to,
      subject,
      html,
    });
  }
}
