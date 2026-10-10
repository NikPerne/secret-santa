import nodemailer, { type Transporter } from 'nodemailer';
import { emailProvider, env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { EmailContent } from './email-templates.js';

/** Never let a slow mail provider hold up a request (e.g. sign-in). */
const TIMEOUT_MS = 15_000;

let transporter: Transporter | undefined;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  return transporter;
}

/** Splits `Secret Santa <santa@example.com>` into name and address. */
export function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return match ? { name: match[1].trim() || undefined, email: match[2].trim() } : { email: from.trim() };
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`.trim());
}

/** Brevo transactional email API (HTTPS). The sender must be verified in Brevo. */
function sendViaBrevo(to: string, content: EmailContent) {
  const sender = parseFrom(env.MAIL_FROM);
  return postJson(
    'https://api.brevo.com/v3/smtp/email',
    { 'api-key': env.BREVO_API_KEY },
    {
      sender,
      to: [{ email: to }],
      subject: content.subject,
      htmlContent: content.html,
      textContent: content.text,
    },
  );
}

/** Resend email API (HTTPS). MAIL_FROM must use a domain verified in Resend. */
function sendViaResend(to: string, content: EmailContent) {
  return postJson(
    'https://api.resend.com/emails',
    { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    { from: env.MAIL_FROM, to: [to], subject: content.subject, html: content.html, text: content.text },
  );
}

/** Outbox used by tests to inspect "sent" emails when no provider is configured. */
export const devOutbox: Array<EmailContent & { to: string }> = [];

/**
 * Sends an email through the configured provider (Brevo / Resend over HTTPS, or SMTP), or logs it
 * to the console when none is configured. Never throws.
 */
export async function sendEmail(to: string, content: EmailContent): Promise<boolean> {
  if (emailProvider === 'console') {
    devOutbox.push({ to, ...content });
    if (devOutbox.length > 50) devOutbox.shift();
    logger.info(
      `\n📧 Email (no email provider configured)\nTo: ${to}\nSubject: ${content.subject}\n\n${content.text}\n`,
    );
    return true;
  }
  try {
    if (emailProvider === 'brevo') await sendViaBrevo(to, content);
    else if (emailProvider === 'resend') await sendViaResend(to, content);
    else await getTransporter().sendMail({ from: env.MAIL_FROM, to, ...content });
    return true;
  } catch (err) {
    logger.error({ err: (err as Error).message, provider: emailProvider }, 'Failed to send email');
    return false;
  }
}
