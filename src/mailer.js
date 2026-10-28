'use strict';

const nodemailer = require('nodemailer');

// Sends contact messages over SMTP. With Gmail, SMTP_PASS must be an app password
// (Google Account > Security > App passwords), never the account password.
function createMailer(env) {
  const configured = Boolean(env.SMTP_USER && env.SMTP_PASS);
  const port = Number(env.SMTP_PORT || 465);

  const transport = configured
    ? nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
    : null;

  return {
    configured,

    async send({ to, replyTo, subject, text }) {
      if (!transport) throw new Error('SMTP is not configured');
      await transport.sendMail({
        from: { name: 'Portfolio contact form', address: env.SMTP_USER },
        to,
        replyTo,
        subject,
        text,
      });
    },
  };
}

module.exports = { createMailer };
