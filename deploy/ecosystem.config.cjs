'use strict';

const path = require('path');
const root = path.join(__dirname, '..');

/** PM2: из корня проекта — pm2 start deploy/ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'kirpich73',
      script: 'server.js',
      cwd: root,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3001'
      }
    }
  ]
};
