import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { saveAppearance, newProfile, prepareRaid, activateRaid, applyResult, recovery, moveItem, prepareMagazine, splitStack, sell, buy, emergencyKit, questAction, applyBuild, transaction } from '../dist/src/domain/profile.js';
import { CATALOG } from '../dist/src/content/catalog.js';
import { fromPreset, presetOf } from '../dist/src/domain/items.js';
import { uid } from '../dist/src/domain/util.js';
import { isPatchSelection, selectedPatches, PATCH_LIMIT, PATCH_OUTPUT_BYTES } from '../dist/src/domain/patches.js';

const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(value).digest('hex');
const usernamePattern = /^[a-zA-Z0-9_]{3,24}$/;
const sessionLifetime = 30 * 24 * 60 * 60 * 1000;

export class AccountStore {
  constructor(file, { recoverInterrupted = true } = {}) {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, profile_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);
    CREATE TABLE IF NOT EXISTS profile_operations (
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      operation_id TEXT NOT NULL, profile_json TEXT NOT NULL,
      created_at INTEGER NOT NULL, PRIMARY KEY(account_id, operation_id)
    );`);
    if (this.db.pragma('user_version', { simple: true }) > 1) throw Error('Версия базы новее сервера');
    this.db.pragma('user_version = 1');
    // Optional, additive feature tables keep the existing database readable by
    // the previous code; all connections, including the result worker, migrate here.
    this.db.transaction(() => {
      this.db.exec(readFileSync(new URL('./migrations/001-patches.sql', import.meta.url), 'utf8'));
    })();
    if (recoverInterrupted) this.recoverInterruptedRaids();
  }

  async passwordHash(password, salt) {
    return (await scrypt(password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 })).toString('hex');
  }

  async register({ username, password, character }) {
    if (!usernamePattern.test(username || '')) throw Error('Логин: 3–24 латинские буквы, цифры или подчёркивание');
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw Error('Пароль должен содержать от 10 до 128 символов');
    if (!character || typeof character !== 'object' || !['BEAR', 'USEC'].includes(character.faction)) throw Error('Выберите сторону персонажа');
    const normalized = username.toLowerCase();
    const salt = randomBytes(16).toString('hex');
    const passwordHash = await this.passwordHash(password, salt);
    const recoveryCode = randomBytes(24).toString('hex');
    const profile = newProfile({ name: character.name, faction: character.faction, face: 0, outfit: 0 });
    const accountId = uid();
    try {
      this.db.prepare('INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?)').run(accountId, normalized, salt, passwordHash, digest(recoveryCode), JSON.stringify(profile), Date.now());
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw Error('Логин уже занят');
      throw error;
    }
    return { profile, recoveryCode, accountId };
  }

  async login(username, password) {
    const account = this.db.prepare('SELECT * FROM accounts WHERE username = ?').get(String(username || '').toLowerCase());
    if (!account || typeof password !== 'string') throw Error('Неверный логин или пароль');
    const actual = Buffer.from(await this.passwordHash(password, account.password_salt), 'hex');
    const expected = Buffer.from(account.password_hash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error('Неверный логин или пароль');
    return this.createSession(account.id);
  }

  recover(username, code, password) {
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw Error('Пароль должен содержать от 10 до 128 символов');
    const account = this.db.prepare('SELECT * FROM accounts WHERE username = ?').get(String(username || '').toLowerCase());
    if (!account || typeof code !== 'string' || !/^[a-f0-9]{48}$/.test(code)) throw Error('Неверный код восстановления');
    const actual = Buffer.from(digest(code), 'hex');
    const expected = Buffer.from(account.recovery_hash, 'hex');
    if (!timingSafeEqual(actual, expected)) throw Error('Неверный код восстановления');
    return this.resetPassword(account.id, password);
  }

  async resetPassword(accountId, password) {
    const salt = randomBytes(16).toString('hex');
    const hash = await this.passwordHash(password, salt);
    const recoveryCode = randomBytes(24).toString('hex');
    this.db.transaction(() => {
      this.db.prepare('UPDATE accounts SET password_salt=?, password_hash=?, recovery_hash=? WHERE id=?').run(salt, hash, digest(recoveryCode), accountId);
      this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(accountId);
    })();
    return { ...this.createSession(accountId), recoveryCode };
  }

  createSession(accountId) {
    const token = randomBytes(32).toString('hex');
    const csrf = randomBytes(24).toString('hex');
    this.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(digest(token), accountId, csrf, Date.now() + sessionLifetime);
    return { token, csrf, accountId, profile: this.profile(accountId) };
  }

  session(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.db.prepare('SELECT account_id, csrf FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token), Date.now());
    return row ? { accountId: row.account_id, csrf: row.csrf, profile: this.profile(row.account_id) } : null;
  }

  logout(token) { if (typeof token === 'string') this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token)); }
  profile(accountId) { const row = this.db.prepare('SELECT profile_json FROM accounts WHERE id=?').get(accountId); return row ? JSON.parse(row.profile_json) : null; }
  saveProfile(accountId, profile) { this.db.prepare('UPDATE accounts SET profile_json=? WHERE id=?').run(JSON.stringify(profile), accountId); return profile; }

  command(accountId, { type, id, target, count, trader, preset, ownedOnly, name, appearance, face, patches, expectedRevision, operationId }) {
    return this.db.transaction(() => {
      if (typeof operationId !== 'string' || !/^[a-f0-9-]{36}$/.test(operationId)) throw Error('Некорректный номер операции');
      const previous = this.db.prepare('SELECT profile_json FROM profile_operations WHERE account_id=? AND operation_id=?').get(accountId, operationId);
      if (previous) return this.profile(accountId);
      const profile = this.profile(accountId);
      if (!profile) throw Error('Аккаунт не найден');
      if (profile.pending) throw Error('Завершите текущий рейд');
      if (profile.revision !== expectedRevision) throw Error('Профиль изменился в другой вкладке. Обновите страницу.');
      let next;
      switch (type) {
        case 'save-appearance': {
          if (patches !== undefined) {
            if (!isPatchSelection(patches)) throw Error('Неверные патчи');
            for (const hash of selectedPatches(patches)) if (!this.patch(accountId, hash)) throw Error('Патч не найден в вашей библиотеке');
          }
          next = saveAppearance(profile, { ...profile.character, appearance, face, ...(patches === undefined ? {} : { patches }) }, operationId);
          break;
        }
        case 'move': next = moveItem(profile, id, target); break;
        case 'pack-mag': next = prepareMagazine(profile, id, false); break;
        case 'unload-mag': next = prepareMagazine(profile, id, true); break;
        case 'split': next = splitStack(profile, id, count); break;
        case 'sell': next = sell(profile, id, trader); break;
        case 'buy': next = buy(profile, id, CATALOG[id]?.category === 'ammo' ? 30 : 1); break;
        case 'rescue': next = emergencyKit(profile); break;
        case 'quest': next = questAction(profile, id); break;
        case 'apply-build': next = applyBuild(profile, id, preset, uid(), ownedOnly === true); break;
        case 'sort': next = transaction(profile, uid(), draft => { draft.stash.sort((a, b) => CATALOG[a.def].category.localeCompare(CATALOG[b.def].category)); }); break;
        case 'rotate': next = transaction(profile, uid(), draft => { const item = [...draft.stash, ...draft.gear.bag, ...draft.gear.safe].find(item => item.id === id); if (!item) throw Error('Предмет не найден'); item.rotated = !item.rotated; }); break;
        case 'save-preset': {
          const item = fromPreset(preset);
          if (!profile.stash.some(i => i.def === item.def) && profile.gear.primary?.def !== item.def && profile.gear.secondary?.def !== item.def) throw Error('Оружие не найдено');
          next = transaction(profile, uid(), draft => { const label = String(name || '').slice(0, 32); if (!label) throw Error('Введите название'); draft.presets = draft.presets.filter(entry => entry.name !== label); if (draft.presets.length >= 20) throw Error('Достигнут лимит 20 пресетов'); draft.presets.push({ name: label, def: item.def, tree: presetOf(item) }); });
          break;
        }
        default: throw Error('Неизвестная команда профиля');
      }
      this.saveProfile(accountId, next);
      this.db.prepare('INSERT INTO profile_operations VALUES (?, ?, ?, ?)').run(accountId, operationId, JSON.stringify(next), Date.now());
      return next;
    })();
  }

  prepareRoom(members, raidId, mapId) {
    return this.db.transaction(() => {
      const profiles = new Map();
      for (const member of members) {
        const profile = this.profile(member.accountId);
        if (!profile || profile.pending) throw Error('Участник уже находится в рейде');
        profiles.set(member.accountId, activateRaid(prepareRaid(profile, raidId, mapId)));
      }
      for (const [accountId, profile] of profiles) this.saveProfile(accountId, profile);
      return profiles;
    })();
  }

  commitResult(accountId, result) {
    return this.db.transaction(() => {
      const profile = this.profile(accountId);
      if (!profile) throw Error('Аккаунт не найден');
      return this.saveProfile(accountId, applyResult(profile, result));
    })();
  }

  recoverInterruptedRaids() {
    this.db.transaction(() => {
      for (const row of this.db.prepare('SELECT id, profile_json FROM accounts').all()) {
        const profile = JSON.parse(row.profile_json);
        if (profile.pending) this.saveProfile(row.id, recovery(profile));
      }
    })();
  }

  patches(accountId) {
    return this.db.prepare('SELECT hash AS id, length(png) AS bytes, created_at AS createdAt FROM patch_assets WHERE account_id=? ORDER BY created_at, hash').all(accountId);
  }
  patch(accountId, hash) { return this.db.prepare('SELECT png FROM patch_assets WHERE account_id=? AND hash=?').get(accountId, hash)?.png || null; }
  addPatch(accountId, png) {
    if (!Buffer.isBuffer(png) || png.length < 24 || png.length > PATCH_OUTPUT_BYTES || png.readUInt32BE(0) !== 0x89504e47 || png.readUInt32BE(4) !== 0x0d0a1a0a || png.readUInt32BE(16) !== 256 || png.readUInt32BE(20) !== 256) throw Error('Неверный формат патча');
    const hash = createHash('sha256').update(png).digest('hex');
    return this.db.transaction(() => {
      if (!this.patch(accountId, hash)) {
        if (this.patches(accountId).length >= PATCH_LIMIT) throw Error('В библиотеке уже 20 патчей. Удалите неиспользуемый');
        this.db.prepare('INSERT INTO patch_assets VALUES (?, ?, ?, ?)').run(accountId, hash, png, Date.now());
      }
      return this.patches(accountId).find(patch => patch.id === hash);
    })();
  }
  deletePatch(accountId, hash) {
    return this.db.transaction(() => {
      const profile = this.profile(accountId);
      if (profile?.pending) throw Error('Завершите текущий рейд');
      if (selectedPatches(profile?.character.patches).includes(hash)) throw Error('Сначала снимите патч и сохраните внешний вид');
      this.db.prepare('DELETE FROM patch_assets WHERE account_id=? AND hash=?').run(accountId, hash);
    })();
  }
  backup(file) { return this.db.backup(file); }
  close() { this.db.close(); }
}
