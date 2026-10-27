// ==============================================================================
// AssetVault: Automated Email Notification Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Sends transactional expiry alerts using Nodemailer (SMTP / Ethereal Dev Sandbox)
// ==============================================================================

import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface ExpiryEmailPayload {
  to: string;
  recipientName: string;
  tenantName: string;
  licenseName: string;
  daysLeft: number;
  expiryDate: string;
  type: 'EXPIRY_30' | 'EXPIRY_15' | 'EXPIRY_7' | 'EXPIRED';
}

class EmailService {
  private transporter: Transporter | null = null;
  private isInitialized = false;

  private async getTransporter(): Promise<Transporter> {
    if (this.transporter && this.isInitialized) {
      return this.transporter;
    }

    if (process.env.NODE_ENV === 'test') {
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      this.isInitialized = true;
      return this.transporter;
    }

    if (env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      logger.info({ host: env.SMTP_HOST, port: env.SMTP_PORT }, 'Configured production SMTP transporter');
    } else {
      // Development mode: Create ethereal test account for zero-config local testing
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info({ user: testAccount.user }, 'Created dynamic Ethereal test account for dev email delivery');
      } catch (err: any) {
        logger.warn({ err }, 'Ethereal test account creation failed; using stream transporter fallback');
        this.transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      }
    }

    this.isInitialized = true;
    return this.transporter;
  }

  /**
   * Generates responsive HTML email template for license expiration alerts
   */
  private generateTemplate(payload: ExpiryEmailPayload): { subject: string; html: string; text: string } {
    const { recipientName, tenantName, licenseName, daysLeft, expiryDate, type } = payload;

    let badgeColor = '#3b82f6';
    let badgeText = 'NOTICE (30 DAYS)';
    let urgencyTitle = `License "${licenseName}" Expires in 30 Days`;

    if (type === 'EXPIRY_15') {
      badgeColor = '#f59e0b';
      badgeText = 'WARNING (15 DAYS)';
      urgencyTitle = `Action Required: License "${licenseName}" Expires in 15 Days`;
    } else if (type === 'EXPIRY_7') {
      badgeColor = '#ef4444';
      badgeText = 'CRITICAL (7 DAYS)';
      urgencyTitle = `Urgent: License "${licenseName}" Expires in 7 Days`;
    } else if (type === 'EXPIRED') {
      badgeColor = '#991b1b';
      badgeText = 'EXPIRED';
      urgencyTitle = `ALERT: License "${licenseName}" Has Expired`;
    }

    const subject = `[AssetVault] ${badgeText}: ${licenseName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <div style="background-color: #0f172a; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
      <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">
        🛡️ AssetVault <span style="font-size: 14px; font-weight: 400; color: #94a3b8;">| Enterprise SaaS</span>
      </h2>
    </div>
    <div style="padding: 24px;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #ffffff; background-color: ${badgeColor}; margin-bottom: 16px;">
        ${badgeText}
      </div>
      <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 18px; color: #0f172a;">${urgencyTitle}</h3>
      <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.5;">
        Hello <strong>${recipientName}</strong>, this is an automated alert from your organization workspace <strong>${tenantName}</strong>.
      </p>

      <div style="background-color: #f1f5f9; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Organization:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${tenantName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Software License:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${licenseName}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Expiration Date:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${expiryDate}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Time Remaining:</td>
            <td style="padding: 6px 0; font-weight: 700; color: ${badgeColor};">${type === 'EXPIRED' ? 'Expired' : `${daysLeft} days`}</td>
          </tr>
        </table>
      </div>

      <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; line-height: 1.5;">
        Please review your covering licenses or trigger an automatic renewal in AssetVault to prevent seat allocations and covered digital assets from entering a non-compliant state.
      </p>

      <a href="${env.CLIENT_URL}/licenses" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 6px;">
        Review License in AssetVault &rarr;
      </a>
    </div>
    <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
      Automated compliance notification generated by AssetVault (BCSE307L Database Systems). Do not reply to this email.
    </div>
  </div>
</body>
</html>
`;

    const text = `
[AssetVault ${badgeText}] ${urgencyTitle}
Organization: ${tenantName}
License: ${licenseName}
Expiration Date: ${expiryDate}
Remaining: ${daysLeft} days

Please visit ${env.CLIENT_URL}/licenses to renew this license or reallocate seats.
`;

    return { subject, html, text };
  }

  /**
   * Dispatches email asynchronously without blocking caller thread
   */
  public async sendExpiryAlert(payload: ExpiryEmailPayload): Promise<boolean> {
    try {
      const transporter = await this.getTransporter();
      const { subject, html, text } = this.generateTemplate(payload);

      const info = await transporter.sendMail({
        from: env.SMTP_FROM,
        to: payload.to,
        subject,
        text,
        html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info(
        {
          to: payload.to,
          messageId: info.messageId,
          license: payload.licenseName,
          previewUrl: previewUrl || undefined,
        },
        'Dispatched license expiry notification email'
      );
      return true;
    } catch (err: any) {
      logger.error({ err, to: payload.to, license: payload.licenseName }, 'Failed to deliver expiry notification email');
      return false;
    }
  }
}

export const emailService = new EmailService();
