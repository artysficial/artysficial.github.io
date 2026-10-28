'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Append-only JSON Lines file: one event per line. Plenty for a personal site's traffic,
// and the file stays readable and easy to back up.
class EventStore {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  async append(event) {
    const record = { at: new Date().toISOString(), ...event };
    await fs.promises.appendFile(this.file, JSON.stringify(record) + '\n');
    return record;
  }

  async all() {
    let raw;
    try {
      raw = await fs.promises.readFile(this.file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }

    const events = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // a half-written line (e.g. after a crash) should not take the admin page down
      }
    }
    return events;
  }
}

// Same interface backed by a MongoDB collection, for hosts whose disk is wiped on restart
// (such as Render's free plan). A free MongoDB Atlas cluster is enough.
class MongoEventStore {
  constructor(collection) {
    this.collection = collection;
  }

  async append(event) {
    const record = { at: new Date().toISOString(), ...event };
    // insertOne adds an _id to the object it is given, so hand it a copy
    await this.collection.insertOne({ ...record });
    return record;
  }

  async all() {
    return this.collection.find({}, { projection: { _id: 0 } }).sort({ at: 1 }).toArray();
  }
}

// MONGODB_URI set: store in MongoDB; otherwise JSON Lines files in dataDir
function createStores({ env, dataDir }) {
  if (env.MONGODB_URI) {
    const { MongoClient } = require('mongodb');
    // the driver connects on first use, so startup does not wait for the database
    const db = new MongoClient(env.MONGODB_URI).db(env.MONGODB_DB || 'portfolio');
    return {
      downloads: new MongoEventStore(db.collection('cvDownloads')),
      messages: new MongoEventStore(db.collection('messages')),
      location: `MongoDB database "${db.databaseName}"`,
      persistent: true,
    };
  }

  return {
    downloads: new EventStore(path.join(dataDir, 'cv-downloads.jsonl')),
    messages: new EventStore(path.join(dataDir, 'messages.jsonl')),
    location: `local files (${path.basename(dataDir)}/)`,
    persistent: false,
  };
}

module.exports = { EventStore, MongoEventStore, createStores };
