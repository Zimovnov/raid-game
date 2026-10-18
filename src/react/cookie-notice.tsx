import { useState } from 'react';

const acknowledgementKey = 'raid-cookie-notice-v1';

function acknowledged(): boolean {
  try { return localStorage.getItem(acknowledgementKey) === 'seen'; }
  catch { return false; }
}

export function CookieNotice() {
  const [visible, setVisible] = useState(() => !acknowledged());
  if (!visible) return null;

  function dismiss() {
    try { localStorage.setItem(acknowledgementKey, 'seen'); } catch { /* Private browsing can deny storage. */ }
    setVisible(false);
  }

  return <aside className="cookie-notice" aria-label="Информация о cookie">
    <div><strong>Cookie для входа</strong><p>Сайт использует обязательный cookie сессии, чтобы сохранять вход в аккаунт. Для рекламы и аналитики cookie не ставим. <a href="/privacy.html">Как хранятся данные</a></p></div>
    <button type="button" onClick={dismiss}>Понятно</button>
  </aside>;
}
