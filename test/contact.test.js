'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeApp, fakeMailer, validMessage } = require('./helpers');

test('a valid message is emailed and stored', async () => {
  const { app, mailer, messages } = makeApp();

  const res = await request(app).post('/api/contact').send(validMessage()).expect(200);

  assert.equal(res.body.ok, true);
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, 'artysficial@gmail.com');
  assert.equal(mailer.sent[0].subject, '[Portfolio] Test lead role');
  assert.deepEqual(mailer.sent[0].replyTo, { name: 'Ada Lovelace', address: 'ada@example.com' });
  assert.match(mailer.sent[0].text, /test lead engagement/);

  const stored = await messages.all();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].delivered, true);
});

test('the subject falls back to the sender name', async () => {
  const { app, mailer } = makeApp();
  await request(app).post('/api/contact').send(validMessage({ subject: '' })).expect(200);
  assert.equal(mailer.sent[0].subject, '[Portfolio] Message from Ada Lovelace');
});

test('invalid input is rejected with field errors and nothing is sent', async () => {
  const { app, mailer, messages } = makeApp();

  const res = await request(app)
    .post('/api/contact')
    .send(validMessage({ fullname: ' ', email: 'not-an-email', message: 'short' }))
    .expect(422);

  assert.equal(res.body.ok, false);
  assert.deepEqual(Object.keys(res.body.errors).sort(), ['email', 'fullname', 'message']);
  assert.equal(mailer.sent.length, 0);
  assert.equal((await messages.all()).length, 0);
});

test('overlong fields are rejected', async () => {
  const { app } = makeApp();
  const res = await request(app).post('/api/contact').send(validMessage({ message: 'x'.repeat(5001) })).expect(422);
  assert.ok(res.body.errors.message);
});

test('line breaks cannot reach mail headers', async () => {
  const { app, mailer } = makeApp();
  await request(app)
    .post('/api/contact')
    .send(validMessage({ fullname: 'Eve\r\nBcc: victim@example.com', subject: 'Hi\nBcc: x@example.com' }))
    .expect(200);
  assert.doesNotMatch(mailer.sent[0].subject, /[\r\n]/);
  assert.doesNotMatch(mailer.sent[0].replyTo.name, /[\r\n]/);
});

test('bots filling the honeypot get a fake success and nothing is sent', async () => {
  const { app, mailer, messages } = makeApp();
  const res = await request(app).post('/api/contact').send(validMessage({ website: 'http://spam.example' })).expect(200);
  assert.equal(res.body.ok, true);
  assert.equal(mailer.sent.length, 0);
  assert.equal((await messages.all()).length, 0);
});

test('submissions faster than a person can type are treated as bots', async () => {
  const { app, mailer } = makeApp();
  await request(app).post('/api/contact').send(validMessage({ startedAt: Date.now() })).expect(200);
  assert.equal(mailer.sent.length, 0);
});

test('a failed delivery tells the visitor and keeps the message', async () => {
  const { app, messages } = makeApp({ mailer: fakeMailer({ fail: true }) });

  const res = await request(app).post('/api/contact').send(validMessage()).expect(502);

  assert.equal(res.body.ok, false);
  assert.match(res.body.message, /artysficial@gmail.com/);
  const [stored] = await messages.all();
  assert.equal(stored.delivered, false);
  assert.equal(stored.error, 'SMTP down');
});

test('in production without SMTP settings the visitor is told to email directly', async () => {
  const { app } = makeApp({ env: { NODE_ENV: 'production' }, mailer: fakeMailer({ configured: false }) });
  const res = await request(app).post('/api/contact').send(validMessage()).expect(502);
  assert.match(res.body.message, /email me directly/);
});

test('without JavaScript the form posts and redirects back to the contact section', async () => {
  const { app, mailer } = makeApp();

  await request(app)
    .post('/api/contact')
    .type('form')
    .set('Accept', 'text/html')
    .send(validMessage())
    .expect(303)
    .expect('Location', '/?contact=sent#contact');
  assert.equal(mailer.sent.length, 1);

  const page = await request(app).get('/?contact=sent').expect(200);
  assert.match(page.text, /Thanks, your message is on its way/);
});

test('the contact endpoint is rate limited', async () => {
  const { app } = makeApp({ contactLimit: 2 });
  await request(app).post('/api/contact').send(validMessage()).expect(200);
  await request(app).post('/api/contact').send(validMessage()).expect(200);
  const res = await request(app).post('/api/contact').send(validMessage()).expect(429);
  assert.match(res.body.message, /Too many messages/);
});
