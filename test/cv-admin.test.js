'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeApp, validMessage } = require('./helpers');
const { summarise } = require('../src/admin');

const auth = (user, password) => 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');

test('the CV downloads as a PDF and the download is recorded', async () => {
  const { app, downloads } = makeApp();

  const res = await request(app)
    .get('/cv?from=sidebar')
    .set('Referer', 'https://www.linkedin.com/in/someone')
    .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
    .expect(200)
    .expect('Content-Type', /pdf/)
    .expect('Content-Disposition', /^attachment; filename="?Rahmadani-Tyas-Ningrum-CV\.pdf"?$/);

  assert.ok(res.body.length > 10_000, 'the real PDF is sent');
  const [event] = await downloads.all();
  assert.equal(event.from, 'sidebar');
  assert.equal(event.referrer, 'www.linkedin.com');
  assert.equal(event.device, 'mobile');
});

test('unexpected source labels are not stored verbatim', async () => {
  const { app, downloads } = makeApp();
  await request(app).get('/cv?from=<script>').expect(200);
  const [event] = await downloads.all();
  assert.equal(event.from, 'direct');
});

test('the old CV URL still works and is tracked', async () => {
  const { app, downloads } = makeApp();
  await request(app).get('/assets/docs/Rahmadani-Tyas-Ningrum-CV.pdf').expect(200).expect('Content-Type', /pdf/);
  const [event] = await downloads.all();
  assert.equal(event.from, 'old-link');
});

test('crawlers download without being counted', async () => {
  const { app, downloads } = makeApp();
  await request(app).get('/cv').set('User-Agent', 'Googlebot/2.1').expect(200);
  assert.equal((await downloads.all()).length, 0);
});

test('the admin page is disabled when no password is configured', async () => {
  const { app } = makeApp();
  await request(app).get('/admin').expect(404);
});

test('the admin page requires the right credentials', async () => {
  const { app } = makeApp({ env: { ADMIN_PASSWORD: 's3cret' } });

  await request(app).get('/admin').expect(401).expect('WWW-Authenticate', /Basic/);
  await request(app).get('/admin').set('Authorization', auth('admin', 'wrong')).expect(401);
  await request(app).get('/admin').set('Authorization', auth('admin', 's3cret')).expect(200);
});

test('the admin page shows downloads and messages', async () => {
  const { app } = makeApp({ env: { ADMIN_PASSWORD: 's3cret' } });

  await request(app).get('/cv?from=resume').set('Referer', 'https://www.google.com/').expect(200);
  await request(app).post('/api/contact').send(validMessage({ subject: 'Hiring for QA lead' })).expect(200);

  const res = await request(app).get('/admin').set('Authorization', auth('admin', 's3cret')).expect(200);
  assert.match(res.text, /<span class="stat-label">CV downloads<\/span><strong>1<\/strong>/);
  assert.match(res.text, /data-tip="[A-Z][a-z]{2} \d{1,2}: 1 download"/);
  assert.match(res.text, /www\.google\.com/);
  assert.match(res.text, /Hiring for QA lead/);
  assert.match(res.headers['cache-control'], /no-store/);
});

test('summarise counts recent downloads and fills empty days', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  const downloads = [
    { at: '2026-10-28T08:00:00Z', from: 'sidebar', referrer: 'direct', device: 'desktop' },
    { at: '2026-10-25T08:00:00Z', from: 'resume', referrer: 'www.linkedin.com', device: 'mobile' },
    { at: '2026-09-01T08:00:00Z', from: 'sidebar', referrer: 'direct', device: 'desktop' },
  ];

  const stats = summarise({ downloads, messages: [{ delivered: false }] }, now);

  assert.deepEqual(stats.totals, { downloads: 3, last7: 2, last30: 2, messages: 1, undelivered: 1 });
  assert.deepEqual(stats.bySource, [['sidebar', 2], ['resume', 1]]);
  assert.equal(stats.daily.length, 14);
  assert.deepEqual(stats.daily.at(-1), { day: '2026-10-28', count: 1 });
  assert.deepEqual(stats.daily.at(-2), { day: '2026-10-27', count: 0 });
});
