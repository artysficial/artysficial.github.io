'use strict';

const LIMITS = { fullname: 100, email: 254, subject: 150, message: 5000 };
const MIN_MESSAGE_LENGTH = 10;
const MIN_FILL_TIME_MS = 3000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
// names and subjects end up in mail headers: never let them carry a line break
const oneLine = (value) => value.replace(/[\r\n]+/g, ' ');

function validate(body) {
  const input = {
    fullname: oneLine(clean(body.fullname)),
    email: clean(body.email),
    subject: oneLine(clean(body.subject)),
    message: clean(body.message),
  };

  const errors = {};
  if (!input.fullname) errors.fullname = 'Please enter your name.';
  if (!EMAIL.test(input.email)) errors.email = 'Please enter a valid email address.';
  if (input.message.length < MIN_MESSAGE_LENGTH) errors.message = 'Please write a little more about how I can help.';

  for (const [field, max] of Object.entries(LIMITS)) {
    if (input[field].length > max) errors[field] = `Please keep this under ${max} characters.`;
  }

  return { input, errors };
}

// bots fill the hidden "website" field, or submit faster than a person can type
function looksAutomated(body, now) {
  if (clean(body.website)) return true;
  const startedAt = Number(body.startedAt);
  return Number.isFinite(startedAt) && startedAt > 0 && now - startedAt < MIN_FILL_TIME_MS;
}

function contactHandler({ store, mailer, mailTo, siteUrl, production, log = console }) {
  return async (req, res) => {
    const body = req.body ?? {};
    const wantsJson = req.is('application/json') || req.accepts(['html', 'json']) === 'json';

    // without JavaScript the form posts normally, so answer with a redirect back to the contact section
    const reply = (status, payload, outcome) => (wantsJson
      ? res.status(status).json(payload)
      : res.redirect(303, `/?contact=${outcome}#contact`));

    // pretend to succeed so bots get no signal to adapt
    if (looksAutomated(body, Date.now())) return reply(200, { ok: true, message: 'Thanks, your message is on its way.' }, 'sent');

    const { input, errors } = validate(body);
    if (Object.keys(errors).length) {
      return reply(422, { ok: false, errors, message: 'Please check the highlighted fields.' }, 'invalid');
    }

    const fallback = `Sorry, the message could not be sent. Please email me directly at ${mailTo}.`;
    let delivered = false;
    let error;

    if (mailer.configured) {
      try {
        await mailer.send({
          to: mailTo,
          replyTo: { name: input.fullname, address: input.email },
          subject: `[Portfolio] ${input.subject || `Message from ${input.fullname}`}`,
          text: `From: ${input.fullname} <${input.email}>\n`
            + `Subject: ${input.subject || '(none)'}\n\n`
            + `${input.message}\n\n`
            + `--\nSent from the contact form on ${siteUrl}`,
        });
        delivered = true;
      } catch (sendError) {
        error = sendError.message;
        log.error('Contact form: email delivery failed:', sendError);
      }
    } else if (!production) {
      log.warn('Contact form: SMTP is not configured, message stored only:', input.email);
    } else {
      error = 'SMTP is not configured';
    }

    // keep every message, so nothing is lost even when email delivery fails
    try {
      await store.append({ type: 'contact', ...input, delivered, ...(error && { error }) });
    } catch (storeError) {
      // once the email is out, a storage hiccup must not turn into an error for the visitor
      log.error('Contact form: message could not be stored:', storeError);
    }

    if (error) return reply(502, { ok: false, message: fallback }, 'error');
    return reply(200, { ok: true, message: 'Thanks, your message is on its way. I will reply by email.' }, 'sent');
  };
}

module.exports = { contactHandler, validate, looksAutomated };
