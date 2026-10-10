import nodemailer, { type Transporter } from 'nodemailer';
import { env, smtpEnabled } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { EmailContent } from './email-templates.js';

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Outbox used by tests to inspect "sent" emails when SMTP is not configured. */
export const devOutbox: Array<EmailContent & { to: string }> = [];

/** Sends an email, or logs it to the console when SMTP is not configured. Never throws. */
export async function sendEmail(to: string, content: EmailContent): Promise<boolean> {
  if (!smtpEnabled) {
    devOutbox.push({ to, ...content });
    if (devOutbox.length > 50) devOutbox.shift();
    logger.info(
      `\n📧 Email (SMTP not configured)\nTo: ${to}\nSubject: ${content.subject}\n\n${content.text}\n`,
    );
    return true;
  }
  try {
    await getTransporter().sendMail({ from: env.MAIL_FROM, to, ...content });
    return true;
  } catch (err) {
    logger.error({ err, to }, 'Failed to send email');
    return false;
  }
}
