'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeApp } = require('./helpers');

const { app } = makeApp();

test('sitemap lists the home page and every article', async () => {
  const res = await request(app).get('/sitemap.xml').expect(200).expect('Content-Type', /xml/);
  assert.match(res.text, /<loc>https:\/\/example.test\/<\/loc>/);
  assert.equal((res.text.match(/<loc>https:\/\/example.test\/articles\//g) || []).length, 6);
});

test('robots.txt points to the sitemap and hides private paths', async () => {
  const res = await request(app).get('/robots.txt').expect(200).expect('Content-Type', /text\/plain/);
  assert.match(res.text, /Sitemap: https:\/\/example.test\/sitemap.xml/);
  assert.match(res.text, /Disallow: \/admin/);
  assert.match(res.text, /Disallow: \/api\//);
});

test('health check reports ok', async () => {
  const res = await request(app).get('/healthz').expect(200);
  assert.equal(res.body.status, 'ok');
});

test('security headers are set', async () => {
  const res = await request(app).get('/').expect(200);
  const csp = res.headers['content-security-policy'];

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
});

test('the inline theme script carries the per-request CSP nonce', async () => {
  const res = await request(app).get('/').expect(200);
  const nonce = res.headers['content-security-policy'].match(/'nonce-([^']+)'/)[1];
  assert.match(res.text, new RegExp(`<script nonce="${nonce.replace(/[+/=]/g, '\\$&')}">`));

  const second = await request(app).get('/').expect(200);
  assert.notEqual(second.headers['content-security-policy'].match(/'nonce-([^']+)'/)[1], nonce);
});

test('responses are compressed', async () => {
  const res = await request(app).get('/').set('Accept-Encoding', 'gzip').expect(200);
  assert.equal(res.headers['content-encoding'], 'gzip');
});
