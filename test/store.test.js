'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoEventStore, createStores } = require('../src/store');
const { createApp } = require('../src/app');
const { fakeMailer, validMessage } = require('./helpers');

// just enough of a MongoDB collection for MongoEventStore
function fakeCollection() {
  const docs = [];
  return {
    docs,
    async insertOne(doc) {
      doc._id = String(docs.length + 1);
      docs.push(doc);
    },
    find(filter, { projection }) {
      let result = docs.map((doc) => ({ ...doc }));
      if (projection?._id === 0) result = result.map(({ _id, ...rest }) => rest);
      return {
        sort: ({ at }) => ({
          toArray: async () => result.sort((a, b) => at * a.at.localeCompare(b.at)),
        }),
      };
    },
  };
}

test('MongoEventStore stores events with a timestamp and returns them without _id', async () => {
  const collection = fakeCollection();
  const store = new MongoEventStore(collection);

  const record = await store.append({ type: 'cv', from: 'sidebar' });

  assert.match(record.at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(record._id, undefined, 'the returned record is not mutated by the driver');
  assert.deepEqual(await store.all(), [record]);
});

test('createStores uses files unless MONGODB_URI is set', () => {
  const files = createStores({ env: {}, dataDir: '/tmp/portfolio-data' });
  assert.equal(files.persistent, false);
  assert.equal(files.location, 'local files (portfolio-data/)');

  // the driver connects lazily, so this does not need a running database
  const mongo = createStores({ env: { MONGODB_URI: 'mongodb://127.0.0.1:1/x', MONGODB_DB: 'site' }, dataDir: '/unused' });
  assert.equal(mongo.persistent, true);
  assert.equal(mongo.location, 'MongoDB database "site"');
});

test('the Vercel entry point is a request handler that serves the site', async () => {
  const handler = require('../api/index');
  assert.equal(typeof handler, 'function');
  await request(handler).get('/healthz').expect(200);
  await request(handler).get('/articles/hsm-testing').expect(200);
});

test('a storage failure after the email was sent still reports success to the visitor', async () => {
  const broken = { append: async () => { throw new Error('database unreachable'); }, all: async () => [] };
  const mailer = fakeMailer();
  const app = createApp({
    env: { NODE_ENV: 'test' },
    stores: { downloads: broken, messages: broken, location: 'test', persistent: true },
    mailer,
    log: { warn() {}, error() {} },
    contactLimit: 100,
  });

  const res = await request(app).post('/api/contact').send(validMessage()).expect(200);
  assert.equal(res.body.ok, true);
  assert.equal(mailer.sent.length, 1);

  // the CV still downloads when tracking cannot be stored
  await request(app).get('/cv').expect(200).expect('Content-Type', /pdf/);
});

test('the admin page explains a storage failure instead of erroring', async () => {
  const broken = { append: async () => {}, all: async () => { throw new Error('bad auth : authentication failed'); } };
  const app = createApp({
    env: { NODE_ENV: 'test', ADMIN_PASSWORD: 's3cret' },
    stores: { downloads: broken, messages: broken, location: 'MongoDB database "portfolio"', persistent: true },
    mailer: fakeMailer(),
    log: { warn() {}, error() {} },
  });

  const res = await request(app).get('/admin').auth('admin', 's3cret').expect(200);
  assert.match(res.text, /Stored data could not be read\.<\/strong> bad auth : authentication failed/);
});
