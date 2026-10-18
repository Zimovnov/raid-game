import { copyFile } from 'node:fs/promises';

await copyFile('dist-web/web/index.html', 'dist-web/index.html');
