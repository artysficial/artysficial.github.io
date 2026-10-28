'use strict';

const crypto = require('node:crypto');

const DAY_MS = 24 * 60 * 60 * 1000;

const digest = (value) => crypto.createHash('sha256').update(value).digest();

// HTTP Basic auth; comparing fixed-length digests keeps the check constant-time
function basicAuth({ user, password }) {
  const expected = digest(`${user}:${password}`);

  return (req, res, next) => {
    const [scheme, encoded] = (req.get('authorization') || '').split(' ');
    const given = scheme === 'Basic' && encoded ? Buffer.from(encoded, 'base64').toString() : '';

    if (crypto.timingSafeEqual(digest(given), expected)) return next();

    res.set('WWW-Authenticate', 'Basic realm="Portfolio admin", charset="UTF-8"');
    res.status(401).send('Authentication required.');
  };
}

// [label, count] pairs, most frequent first
function tally(items, key) {
  const counts = new Map();
  for (const item of items) {
    const label = item[key] || 'unknown';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const byTime = (a, b) => a.at.localeCompare(b.at);

function summarise(events, now = new Date()) {
  // never trust storage order: "recent" must mean newest
  const downloads = [...events.downloads].sort(byTime);
  const messages = [...events.messages].sort(byTime);
  const within = (days) => downloads.filter((event) => now - new Date(event.at) < days * DAY_MS).length;

  // one row per day for the last 14 days, including days without downloads
  const perDay = new Map(tally(downloads.map((event) => ({ day: event.at.slice(0, 10) })), 'day'));
  const daily = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(now - (13 - i) * DAY_MS).toISOString().slice(0, 10);
    return { day, count: perDay.get(day) || 0 };
  });

  return {
    totals: {
      downloads: downloads.length,
      last7: within(7),
      last30: within(30),
      messages: messages.length,
      undelivered: messages.filter((message) => !message.delivered).length,
    },
    bySource: tally(downloads, 'from'),
    byReferrer: tally(downloads, 'referrer'),
    byDevice: tally(downloads, 'device'),
    daily,
    peak: Math.max(1, ...daily.map((row) => row.count)),
    recentDownloads: downloads.slice(-20).reverse(),
    messages: messages.slice(-50).reverse(),
  };
}

module.exports = { basicAuth, summarise };
