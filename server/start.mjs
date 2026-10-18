import path from 'node:path';
import { createGameServer } from './app.mjs';

const host = process.env.RAID_HOST || '127.0.0.1';
const port = Number(process.env.RAID_PORT || 8081);
const dataDir = process.env.RAID_DATA_DIR || path.resolve('.data');
const origins = (process.env.RAID_ALLOWED_ORIGINS || `http://127.0.0.1:${port},http://127.0.0.1:5173`).split(',');
const app = createGameServer({ dbFile: path.join(dataDir, 'raid-game.sqlite'), staticDir: path.resolve('dist-web'), origins, secureCookies: process.env.RAID_SECURE_COOKIES === '1', admissionFile: path.join(dataDir, 'admission.closed') });
app.server.listen(port, host, () => console.log(`RAID GAME server: http://${host}:${port}`));
process.on('SIGUSR2', () => { app.beginDrain(); console.log('RAID GAME: new raids paused for update'); });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void app.close().then(() => process.exit(0)); });
