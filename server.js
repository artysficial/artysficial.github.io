'use strict';

const { createApp } = require('./src/app');

const port = Number(process.env.PORT) || 3000;

createApp().listen(port, () => {
  console.log(`Portfolio running at http://localhost:${port}`);
});
