import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createGameServer } from '../server/app.mjs';

test('online account uses protected session cookie, CSRF and origin checks without exposing private files', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'raid-security-'));
  const origin = 'https://raid-game.ru';
  const app = createGameServer({ dbFile: path.join(dir, 'accounts.sqlite'), staticDir: path.resolve('dist-web'), origins: [origin], secureCookies: true });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const page = await fetch(base + '/');
    assert.equal(page.status, 200);
    assert.match(await page.text(), /cookie-root/);
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    const privacy = await fetch(base + '/privacy.html');
    assert.equal(privacy.status, 200);
    assert.match(await privacy.text(), /Данные и cookie/);
    for (const privatePath of ['/package.json', '/server/store.mjs', '/.env']) assert.notEqual((await fetch(base + privatePath)).status, 200);

    const wrongOrigin = await fetch(base + '/api/register', { method: 'POST', headers: { Origin: 'https://elsewhere.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(wrongOrigin.status, 403);
    const registered = await fetch(base + '/api/register', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'privacy_test', password: 'distinct-password-123', character: { name: 'Проверка', faction: 'BEAR' } }) });
    assert.equal(registered.status, 201);
    const cookie = registered.headers.get('set-cookie');
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=2592000']) assert(cookie.includes(attribute), attribute);
    const token = cookie.split(';')[0];
    assert.equal((await fetch(base + '/api/me', { headers: { Cookie: token } })).status, 200);
    const forbidden = await fetch(base + '/api/profile/command', { method: 'POST', headers: { Origin: origin, Cookie: token, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(forbidden.status, 403);
    const { csrf } = await registered.json();
    const logout = await fetch(base + '/api/logout', { method: 'POST', headers: { Origin: origin, Cookie: token, 'X-CSRF-Token': csrf } });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0.*Secure/);
    assert.equal((await fetch(base + '/api/me', { headers: { Cookie: token } })).status, 401);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
