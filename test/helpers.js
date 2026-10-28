'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { EventStore } = require('../src/store');

const silentLog = { warn() {}, error() {} };

// a mailer that records what it would have sent, or fails on demand
function fakeMailer({ configured = true, fail = false } = {}) {
  const sent = [];
  return {
    configured,
    sent,
    async send(mail) {
      if (fail) throw new Error('SMTP down');
      sent.push(mail);
    },
  };
}

function makeApp({ env = {}, mailer = fakeMailer(), ...options } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-test-'));
  const downloads = new EventStore(path.join(dataDir, 'cv-downloads.jsonl'));
  const messages = new EventStore(path.join(dataDir, 'messages.jsonl'));
  const app = createApp({
    env: { NODE_ENV: 'test', SITE_URL: 'https://example.test', ...env },
    dataDir,
    stores: { downloads, messages, location: dataDir, persistent: false },
    mailer,
    log: silentLog,
    contactLimit: 100,
    ...options,
  });
  return { app, mailer, downloads, messages };
}

// a submission that passes validation and the spam checks
const validMessage = (overrides = {}) => ({
  fullname: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Test lead role',
  message: 'Hello, I would like to talk about a test lead engagement.',
  website: '',
  startedAt: Date.now() - 60_000,
  ...overrides,
});

module.exports = { makeApp, fakeMailer, validMessage };
