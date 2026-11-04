import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
  console.log(`Health: http://localhost:${env.API_PORT}/api/health`);
});
