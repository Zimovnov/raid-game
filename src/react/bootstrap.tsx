import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { ViewModel } from '../ui/views.js';
import type { Profile } from '../domain/types.js';
import { OnlineApi } from '../network/online-api.js';
import { AccessGate } from './gate.js';
import { CookieNotice } from './cookie-notice.js';
import '../../style.css';
import './interface.css';

export function isPhone(userAgent: string, coarsePointer: boolean, screenWidth: number): boolean {
  return /iPhone|iPod|Android.*Mobile|Windows Phone|Opera Mini|Mobi/i.test(userAgent)
    || (coarsePointer && screenWidth <= 900 && /Android|iPad|iOS/i.test(userAgent));
}

function mount() {
  const root = createRoot(document.getElementById('react-root')!);
  createRoot(document.getElementById('cookie-root')!).render(<CookieNotice />);
  const phone = isPhone(navigator.userAgent, matchMedia('(pointer: coarse)').matches, screen.width);
  if (phone) {
    root.render(<main className="phone-stop"><div className="phone-stop__mark">РЕЙД</div><h1>Игра доступна на компьютере</h1><p>Откройте сайт на десктопе с клавиатурой и мышью.</p></main>);
    return;
  }
  function startGame(api: OnlineApi | null, profile: Profile | null) {
    flushSync(() => root.render(<><canvas id="scene" aria-label="Трёхмерная сцена игры" /><main id="app"><section className="boot"><b>РЕЙД</b><p>Загрузка игры…</p></section></main><div id="toast" role="status" aria-live="polite" /></>));
    let timeout = 0;
    void Promise.race([
      Promise.all([import('../main.js'), import('./screen.js')]),
      new Promise<never>((_, reject) => { timeout = window.setTimeout(() => reject(Error('Загрузка игровых модулей превысила 20 секунд')), 20000); }),
    ]).then(([{ Game }, { Screen }]) => {
      const game = new Game(api, profile, true);
      const viewRoot = createRoot(document.getElementById('app')!);
      game.setViewRenderer((view: ViewModel) => flushSync(() => viewRoot.render(<Screen view={view} />)));
      void game.boot();
      window.addEventListener('pagehide', () => { game.dispose(); viewRoot.unmount(); }, { once: true });
    }).catch(error => {
      root.render(<main className="boot"><h1>Игра не запустилась</h1><p>Проверьте соединение и поддержку WebGL2.</p><button onClick={() => location.reload()}>Повторить</button></main>);
      console.error(error);
    }).finally(() => window.clearTimeout(timeout));
  }
  if (new URLSearchParams(location.search).get('offline') === '1') {
    startGame(null, null);
    return;
  }
  const api = new OnlineApi();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  void api.me(controller.signal).then(profile => startGame(api, profile)).catch(error => {
    const initialError = (error as Error).message === 'Войдите в аккаунт' ? '' : 'Не удалось проверить вход. Проверьте соединение и повторите попытку.';
    root.render(<AccessGate api={api} start={startGame} initialError={initialError} />);
  }).finally(() => window.clearTimeout(timeout));
}

mount();
