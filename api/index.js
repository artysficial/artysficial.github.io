'use strict';

// Vercel entry point: vercel.json routes every request that is not a static file here,
// and an Express app is itself a (req, res) handler
const { createApp } = require('../src/app');

module.exports = createApp();
