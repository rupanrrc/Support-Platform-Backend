import nodemailer from "nodemailer";
import { getEnv } from "../config/env.js";

/**
 * Sends an email using SMTP settings from the environment.
 * When SMTP is not configured, logs the message in non-production environments.
 * @param {{ to: string; subject: string; text: string; html?: string }} params
 */
export async function sendEmail({ to, subject, text, html }) {
  const env = getEnv();

  if (!env.SMTP_HOST) {
    if (env.NODE_ENV !== "production") {
      console.info("[mailer] SMTP not configured. Email would be sent:", {
        to,
        subject,
        text
      });
    }
    return;
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && env.SMTP_PASS
      ? {
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        }
      : {})
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    ...(html ? { html } : {})
  });
}
