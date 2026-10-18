import type { Appearance } from '../content/apparel.js';
import type { Character, Profile } from '../domain/types.js';
import type { PatchInfo, PatchSelection } from '../domain/patches.js';

export interface ProfileCommand {
  type: 'save-appearance' | 'move' | 'pack-mag' | 'unload-mag' | 'split' | 'sell' | 'buy' | 'rescue' | 'quest' | 'apply-build' | 'sort' | 'rotate' | 'save-preset';
  appearance?: Appearance;
  face?: number;
  patches?: PatchSelection;
  id?: string;
  target?: string;
  count?: number;
  trader?: number;
  preset?: object;
  ownedOnly?: boolean;
  name?: string;
}

export class OnlineApi {
  private csrf = '';
  current: Profile | null = null;

  private async request(path: string, body?: object, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const response = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      signal,
      headers: { ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': this.csrf } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw Error(String(data.error || 'Сервер недоступен'));
    if (typeof data.csrf === 'string') this.csrf = data.csrf;
    if (data.profile) this.current = data.profile as Profile;
    return data;
  }

  async me(signal?: AbortSignal): Promise<Profile> { return (await this.request('me', undefined, signal)).profile as Profile; }
  async patches(): Promise<PatchInfo[]> { return (await this.request('patches')).patches as PatchInfo[]; }
  async patch(id: string): Promise<Blob | null> {
    const response = await fetch('/api/patches/' + id + '.png', { credentials: 'same-origin' });
    if (response.status === 404) return null;
    if (!response.ok) throw Error('Не удалось загрузить патч');
    return response.blob();
  }
  async uploadPatch(file: Blob): Promise<PatchInfo> {
    const response = await fetch('/api/patches', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-CSRF-Token': this.csrf }, body: file });
    const data = await response.json() as { patch?: PatchInfo; error?: string };
    if (!response.ok || !data.patch) throw Error(data.error || 'Не удалось загрузить патч');
    return data.patch;
  }
  async deletePatch(id: string): Promise<void> { await this.request('patches/' + id + '/delete', {}); }
  async login(username: string, password: string): Promise<Profile> { return (await this.request('login', { username, password })).profile as Profile; }
  async register(username: string, password: string, character: Character): Promise<{ profile: Profile; recoveryCode: string }> {
    const data = await this.request('register', { username, password, character });
    return { profile: data.profile as Profile, recoveryCode: String(data.recoveryCode) };
  }
  async recover(username: string, code: string, password: string): Promise<{ profile: Profile; recoveryCode: string }> {
    const data = await this.request('recover', { username, code, password });
    return { profile: data.profile as Profile, recoveryCode: String(data.recoveryCode) };
  }
  async command(command: ProfileCommand): Promise<Profile> {
    if (!this.current) throw Error('Войдите в аккаунт');
    return (await this.request('profile/command', { ...command, expectedRevision: this.current.revision, operationId: crypto.randomUUID() })).profile as Profile;
  }
  async logout(): Promise<void> { await this.request('logout', {}); this.current = null; this.csrf = ''; }
  update(profile: Profile) { this.current = profile; }
}
