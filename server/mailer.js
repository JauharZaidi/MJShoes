import nodemailer from 'nodemailer';
import logger from './logger.js';

let transporter;

async function initMailer() {
  if (transporter) return transporter;

  const isProduction = process.env.NODE_ENV === 'production';
  const hasSmtpConfig = process.env.SMTP_HOST && process.env.SMTP_USER;

  if (isProduction && hasSmtpConfig) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    logger.info('Production SMTP mailer initialized.');
  } else {
    if (isProduction) {
      logger.error(
        'PRODUCTION EMAIL MISCONFIGURED: SMTP_HOST/SMTP_USER not set — falling back to a throwaway ' +
        'Ethereal test inbox. Customers will NOT receive order confirmation or payment-failure emails. ' +
        'Set SMTP_HOST, SMTP_USER, SMTP_PASS in server/.env to fix this.'
      );
    }
    // Fallback Mock / Ethereal for non-prod or when SMTP lacks config
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: testAccount.user, // generated ethereal user
          pass: testAccount.pass, // generated ethereal password
        },
      });
      logger.info('Ethereal Mock mailer initialized for Testing context.');
    } catch (e) {
      logger.error('Failed to init mock mailer:', e);
    }
  }

  return transporter;
}

export async function sendMail({ to, subject, html }) {
  try {
    const tp = await initMailer();
    if (!tp) {
      logger.warn('Transporter unavailable. Skipping email send.');
      return;
    }

    const info = await tp.sendMail({
      from: process.env.EMAIL_FROM || '"MJ Shoes" <noreply@mjshoes.xyz>',
      to,
      subject,
      html,
    });

    logger.info(`Message sent: ${info.messageId}`);
    
    // In dev / mock context, we log URL for previewing
    if (nodemailer.getTestMessageUrl(info)) {
      logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    }

    return info;
  } catch (error) {
    logger.error('Failed to send mail:', error);
    // don't throw, failing an email format shouldn't break the webhook fulfillment entirely
  }
}

export async function sendOrderConfirmation(email, orderDetails) {
  const html = `
    <h2>Order Confirmed!</h2>
    <p>Thank you for shopping at MJ Store. Your order <strong>${orderDetails.id}</strong> has been successfully processed.</p>
    <p>Total: ₹${(orderDetails.amount / 100).toLocaleString('en-IN')}</p>
    <p>We will notify you once your items ship.</p>
  `;
  await sendMail({ to: email, subject: 'Your MJ Store Order Confirmation', html });
}

export async function sendPaymentFailure(email, orderId) {
  const html = `
    <h2>Payment Failed</h2>
    <p>There was an issue processing payment for order <strong>${orderId}</strong>.</p>
    <p>If money was deducted, it will be refunded by your bank within 3-5 business days. Please try placing your order again.</p>
  `;
  await sendMail({ to: email, subject: 'Payment Failed - MJ Store', html });
}
