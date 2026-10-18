import { useState, type FormEvent } from 'react';
import type { Profile } from '../domain/types.js';
import type { OnlineApi } from '../network/online-api.js';

type Mode = 'login' | 'register' | 'recover' | 'code';

export function AccessGate({ api, start, initialError = '' }: { api: OnlineApi; start: (api: OnlineApi | null, profile: Profile | null) => void; initialError?: string }) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [faction, setFaction] = useState<'BEAR' | 'USEC'>('BEAR');
  const [recovery, setRecovery] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [profile, setProfile] = useState<Profile | null>(null);

  function switchMode(next: Mode) { setMode(next); setError(''); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'login') start(api, await api.login(username, password));
      if (mode === 'register') {
        const result = await api.register(username, password, { name: characterName, faction, face: 0, outfit: 0 });
        setProfile(result.profile); setRecovery(result.recoveryCode); setPassword(''); setMode('code');
      }
      if (mode === 'recover') {
        const result = await api.recover(username, recovery, password);
        setProfile(result.profile); setRecovery(result.recoveryCode); setPassword(''); setMode('code');
      }
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <main className="access-gate">
    <div className="access-gate__identity"><strong>РЕЙД</strong><p>Подготовка. Риск. Эвакуация.</p></div>
    <section className="access-panel" aria-labelledby="access-heading">
      <h1 id="access-heading">{mode === 'register' ? 'Создать аккаунт' : mode === 'recover' ? 'Восстановить доступ' : mode === 'code' ? 'Сохраните код восстановления' : 'Войти в игру'}</h1>
      {mode === 'code' ? <>
        <p>Этот код выдаётся один раз. Он позволит сменить пароль без почты.</p>
        <output className="recovery-code">{recovery}</output>
        <button type="button" onClick={() => void navigator.clipboard.writeText(recovery)}>Скопировать код</button>
        <label className="access-check"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} />Я сохранил код</label>
        <button className="primary" disabled={!saved || !profile} onClick={() => start(api, profile)}>Войти в игру</button>
      </> : <form onSubmit={event => void submit(event)}>
        <label>Логин<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={24} /></label>
        {mode === 'register' && <><label>Имя персонажа<input value={characterName} onChange={event => setCharacterName(event.target.value)} required maxLength={32} /></label><label>Сторона<select value={faction} onChange={event => setFaction(event.target.value as 'BEAR' | 'USEC')}><option value="BEAR">BEAR</option><option value="USEC">USEC</option></select></label></>}
        {mode === 'recover' && <label>Код восстановления<input value={recovery} onChange={event => setRecovery(event.target.value)} required autoComplete="off" /></label>}
        <label>{mode === 'recover' ? 'Новый пароль' : 'Пароль'}<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} required minLength={10} maxLength={128} /></label>
        {error && <p className="access-error" role="alert">{error}</p>}
        {initialError && error === initialError && <button type="button" onClick={() => location.reload()}>Повторить загрузку</button>}
        <button className="primary" disabled={busy} type="submit">{busy ? 'Подождите…' : mode === 'register' ? 'Создать аккаунт' : mode === 'recover' ? 'Сменить пароль' : 'Войти онлайн'}</button>
      </form>}
      {mode !== 'code' && <div className="access-links">
        {mode !== 'login' && <button type="button" className="ghost" onClick={() => switchMode('login')}>Вход</button>}
        {mode !== 'register' && <button type="button" className="ghost" onClick={() => switchMode('register')}>Регистрация</button>}
        {mode !== 'recover' && <button type="button" className="ghost" onClick={() => switchMode('recover')}>Забыли пароль?</button>}
      </div>}
      <div className="access-offline"><p>Локальный профиль хранится только в этом браузере.</p><button type="button" onClick={() => { location.href = '/?offline=1'; }}>Играть офлайн</button></div>
    </section>
  </main>;
}
