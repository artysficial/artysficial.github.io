'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { makeApp } = require('./helpers');

const { app } = makeApp();

test('home page renders every section from the content files', async () => {
  const res = await request(app).get('/').expect(200).expect('Content-Type', /html/);

  for (const page of ['about', 'resume', 'portfolio', 'publications', 'insights', 'contact']) {
    assert.match(res.text, new RegExp(`data-page="${page}"`));
  }
  assert.match(res.text, /Rahmadani Tyas Ningrum/);
  assert.match(res.text, /Test Lead &amp; Senior Automation SDET/);
  assert.match(res.text, /SDET Automation Framework/);
  assert.equal((res.text.match(/data-filter-item/g) || []).length, 10, 'all ten projects are listed');
  assert.equal((res.text.match(/class="blog-post-item"/g) || []).length, 6, 'all six articles are listed');
  assert.match(res.text, /<time datetime="2022-09">Sep 2022<\/time>/);
});

test('home page uses the configured site URL for canonical links', async () => {
  const res = await request(app).get('/').expect(200);
  assert.match(res.text, /<link rel="canonical" href="https:\/\/example.test\/">/);
});

test('article pages render from content/articles', async () => {
  const res = await request(app).get('/articles/hsm-testing').expect(200);

  assert.match(res.text, /<h1>Testing Hardware Security Modules: a regression strategy for cryptographic products<\/h1>/);
  assert.match(res.text, /Known-answer tests/);
  assert.match(res.text, /<time datetime="2026-10-27">October 2026<\/time>/);
  // the article lists the other five under "More insights", not itself
  assert.equal((res.text.match(/<li><a href="\/articles\//g) || []).length, 5);
});

test('old static-site URLs redirect permanently', async () => {
  await request(app).get('/index.html').expect(301).expect('Location', '/');
  await request(app).get('/articles/hsm-testing.html').expect(301).expect('Location', '/articles/hsm-testing');
});

test('unknown pages return a 404 page', async () => {
  const res = await request(app).get('/articles/does-not-exist').expect(404);
  assert.match(res.text, /This page does not exist/);
});

test('static assets are served', async () => {
  await request(app).get('/assets/css/style.css').expect(200).expect('Content-Type', /css/);
  await request(app).get('/assets/images/avatar-memoji.png').expect(200).expect('Content-Type', /png/);
});

test('stylesheets and scripts carry a content version', async () => {
  const res = await request(app).get('/').expect(200);
  assert.match(res.text, /\/assets\/css\/style\.css\?v=[0-9a-f]{10}/);
  assert.match(res.text, /\/assets\/js\/script\.js\?v=[0-9a-f]{10}/);
});
