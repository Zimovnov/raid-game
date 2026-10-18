import { FABRIC_ASSETS } from '../content/fabric-assets.js';
import { patchControls } from '../ui/patches.js';
import type { ViewModel } from '../ui/views.js';
import { bindingNames, screen } from '../ui/views.js';
import { AMMO, ARMOR, CATALOG, LOOT, MODULES, QUESTS, TRADERS, WEAPONS } from '../content/catalog.js';
import { MAPS, RAID_MAPS } from '../content/maps.js';
import { APPEARANCE_PRESETS, CAMOUFLAGES, normalizeAppearance } from '../content/apparel.js';
import { wardrobeEquipment, wardrobeFields } from '../ui/wardrobe.js';
import { armorAbsorption, equipmentSlot } from '../domain/equipment.js';
import { WORKSHOP_PRESETS } from '../content/presets.js';
import { money } from '../domain/util.js';
import { purchaseCost, quoteBuild } from '../domain/profile.js';
import { calculateStats, createItem, createWeapon, flatGear, getSlots, moduleProblems, pack, presetOf, value, walk, weight } from '../domain/items.js';
import { availableRounds, compatibleMagazine, detachable, feedRounds, isMagazine, loadedRounds, magazineCapacity } from '../domain/ammunition.js';
import { icon, mapSvg, timeText } from '../ui/helpers.js';
import { carriedWeightText, conditionHtml, exitGuidance, guidanceText, headingText, keyLabel, objectivesHtml, quickslotsHtml, useLabel } from '../ui/raid-info.js';
import type { Item } from '../domain/types.js';
import type { CSSProperties } from 'react';

function Menu({ view }: { view: ViewModel }) {
  return <>
    <section className="menu menu--react" aria-label="Главное меню">
      <h1 className="wordmark">РЕЙД</h1>
      <p className="menu__lead">Подготовь снаряжение. Собери отряд. Вернись с добычей.</p>
      <div className="menu__actions">
        {view.profile && <button className="primary" data-act="create-from-menu">Создать отряд</button>}
        {view.profile && <button data-act="join-from-menu">Присоединиться к друзьям</button>}
        {view.profile && <button data-act="nav" data-id="maps">Одиночный рейд</button>}
        <button className={!view.profile ? 'primary' : ''} data-act="nav" data-id={view.profile ? 'stash' : 'character'}>{view.profile ? 'Подготовить снаряжение' : 'Создать персонажа'}</button>
        <button data-act="nav" data-id="settings">Настройки</button>
        <button data-act="switch-mode">{view.online ? 'Офлайн-режим' : 'Войти онлайн'}</button>
        {view.online && <button className="ghost" data-act="logout">Выйти из аккаунта</button>}
        <button className="ghost" data-act="nav" data-id="about">Об игре</button>
      </div>
      <p className="menu__risk"><b>Своя экипировка. Общий риск.</b> Эвакуируйтесь с добычей или потеряйте снаряжение в рейде.</p>
    </section>
    <div className="main-note"><b>Своя экипировка. Общий риск.</b><p>Эвакуируйтесь с добычей или потеряйте снаряжение в рейде.</p></div>
    <span className="version">REID 0.6 · ДАЛЬНИЕ РУБЕЖИ</span>
  </>;
}

function Header({ view }: { view: ViewModel }) {
  const sections = [['stash', 'Схрон'], ['gunsmith', 'Оружейная'], ['wardrobe', 'Гардероб'], ['traders', 'Торговцы'], ['quests', 'Задания'], ['lobby', 'Отряд'], ['maps', 'В рейд'], ['settings', 'Настройки']];
  return <header className="header header--react">
    <button className="brand" data-act="nav" data-id="main">РЕЙД</button>
    <nav aria-label="Разделы игры">{sections.map(([id, label]) => <button key={id} className={view.page === id ? 'active' : ''} data-act="nav" data-id={id} disabled={!view.profile && id !== 'settings'}>{label}</button>)}</nav>
    {view.profile && <div className="balance"><b>{money(view.profile.cash)}</b><span>{view.profile.character.name} · {view.profile.character.faction}</span></div>}
  </header>;
}

function OnlineLobby({ view }: { view: ViewModel }) {
  const lobby = view.lobby;
  const self = lobby?.members.find(member => member.id === view.profile?.id);
  const everyoneReady = !!lobby?.members.length && lobby.members.every(member => member.ready && member.connected);
  const ended = lobby?.stage === 'raid' && view.snapshot?.players.every(actor => actor.status !== 'active');
  return <>
    <Header view={view} />
    <section className="content online-lobby">
      <div className="page-head"><div><h1>{lobby ? `Отряд · ${lobby.members.length} / ${lobby.capacity || 5}` : 'Отряд'}</h1><p className="small">Закрытый серверный рейд для вас и друзей.</p></div></div>
      {!lobby ? <div className="lobby-layout">
        <section className="panel stack"><h2>Создать отряд</h2><p>До пяти участников. Рейд продолжится, даже если создатель закроет вкладку.</p><button className="primary" data-act="create-room" disabled={view.saving}>{view.saving ? 'Подключение…' : 'Создать отряд'}</button><div className="divider" /><label>Код или ссылка приглашения<input id="join-code" placeholder="Вставьте приглашение" defaultValue={view.code} /></label><button data-act="join-room" disabled={view.saving}>Присоединиться</button></section>
        <aside className="panel stack"><h2>Как играть вместе</h2><p>Каждому нужен собственный онлайн-аккаунт и подготовленная экипировка. Приглашение действует до начала рейда.</p><button className="ghost" data-act="nav" data-id="stash">Подготовить снаряжение</button></aside>
      </div> : <div className="lobby-layout">
        <section className="panel stack">
          <div className="row between"><h2>{view.host ? 'Ваш отряд' : 'Отряд друга'}</h2><span className={`small ${view.connected ? 'good' : 'bad'}`} role="status">{view.connected ? 'Связь с сервером есть' : 'Переподключение…'}</span></div>
          <div role="list" aria-label="Участники отряда">{lobby.members.map((member, index) => <div className="member" role="listitem" key={member.id}><span className="face">{String(index + 1).padStart(2, '0')}</span><div><b>{member.character.name}</b><small>{member.character.faction} · {member.gear.primary ? CATALOG[member.gear.primary.def].name : member.gear.secondary ? CATALOG[member.gear.secondary.def].name : 'Без оружия'}</small></div><span className={`ready small ${member.ready ? 'good' : 'muted'}`}>{!member.connected ? 'Обрыв связи' : member.loaded && lobby.stage === 'loading' ? 'Загружен' : member.ready ? 'Готов' : 'Не готов'}</span></div>)}</div>
          {view.host && <><label>Код приглашения<input className="invite" id="invite-code" value={view.code} readOnly /></label><div className="row"><button data-act="copy-invite">Копировать ссылку</button><button data-act="copy-code">Копировать код</button></div></>}
          <div className="divider" />
          <label>Карта<select id="lobby-map" key={lobby.mapId} defaultValue={lobby.mapId} disabled={!view.host || lobby.stage !== 'lobby'}>{RAID_MAPS.map(map => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label>
          <label className="row"><input type="checkbox" id="friendly-fire" key={String(lobby.friendlyFire)} defaultChecked={lobby.friendlyFire} disabled={!view.host || lobby.stage !== 'lobby'} />Огонь по своим</label>
          <div className="row"><button className={self?.ready ? '' : 'primary'} data-act="ready" disabled={lobby.stage !== 'lobby' || !view.connected}>{self?.ready ? 'Отменить готовность' : 'Я готов'}</button>{view.host && <button className="primary" data-act="start-room" disabled={!everyoneReady || lobby.stage !== 'lobby' || view.saving}>Начать рейд</button>}{lobby.stage === 'raid' && <button data-act="return-raid">Вернуться в рейд</button>}{view.host && ended && <button data-act="next-room">Следующий рейд</button>}</div>
        </section>
        <aside className="panel stack"><h2>Состояние</h2><p className="network-state">{view.network}</p><p className="small">При разрыве связи персонаж остаётся в рейде 60 секунд и может получить урон.</p><button className="danger" data-act="leave-room">Выйти из отряда</button></aside>
      </div>}
    </section>
  </>;
}

function OfflineLobby({ view }: { view: ViewModel }) {
  const lobby = view.lobby;
  const self = lobby?.members.find(member => member.id === view.profile?.id);
  const everyoneReady = !!lobby?.members.length && lobby.members.every(member => member.ready && member.connected);
  return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><div><h1>{lobby ? `Отряд · ${lobby.members.length} / 2` : 'Отряд'}</h1><p className="small">Настоящий WebRTC-канал между двумя браузерами. Хозяин управляет симуляцией рейда.</p></div></div>
    {!lobby ? <div className="lobby-layout"><section className="panel stack"><h2>Позвать друга</h2><p>Сначала подготовьте экипировку. Другу нужна та же сборка игры и свой персонаж.</p><button className="primary" data-act="create-room" disabled={view.saving}>Создать отряд</button><div className="divider" /><label>Код или ссылка-приглашение<input id="join-code" placeholder="Вставьте приглашение" defaultValue={view.code} /></label><button data-act="join-room" disabled={view.saving}>Подключиться</button><div className="divider" /><label>Сигнализация<select id="signal-mode" defaultValue={new URLSearchParams(location.search).get('signal') === 'local' ? 'local' : 'public'}><option value="public">Общий PeerServer — для игры через интернет</option><option value="local">Встроенный сервер — для localhost / LAN-теста</option></select></label></section><aside className="panel stack"><span className="caps">Важно</span><p>Через интернет оба игрока открывают опубликованную игру. Ссылка на ваш localhost другу не подойдёт.</p><p>В некоторых сетях прямой канал не устанавливается без TURN. Здесь нет гарантии соединения через любой роутер.</p><p className="small">Одиночный режим и тир не используют сигнализацию.</p><button className="ghost" data-act="nav" data-id="maps">Одиночный рейд</button></aside></div> :
    <div className="lobby-layout"><section className="panel"><div className="row between"><h2>{view.host ? 'Ваш отряд' : 'Отряд друга'}</h2><span className={`small ${view.connected ? 'good' : 'bad'}`}>{view.connected ? 'Канал установлен' : 'Соединение…'}</span></div>{lobby.members.map((member, index) => <div className="member" key={member.id}><span className="face">{String(index + 1).padStart(2, '0')}</span><div><b>{member.character.name}</b><small>{member.character.faction} · {member.gear.primary ? CATALOG[member.gear.primary.def].name : member.gear.secondary ? CATALOG[member.gear.secondary.def].name : 'Без оружия'}</small></div><span className={`ready small ${member.ready ? 'good' : 'muted'}`}>{!member.connected ? 'Обрыв связи' : member.loaded && lobby.stage === 'loading' ? 'Загружен' : member.ready ? 'Готов' : 'Не готов'}</span></div>)}<div className="spacer" />{view.host && <><label>Код приглашения<input className="invite" readOnly id="invite-code" value={view.code} /></label><div className="row" style={{ marginTop: 10 }}><button data-act="copy-invite">Копировать ссылку</button><button data-act="copy-code">Копировать код</button></div></>}<div className="divider" /><label>Карта<select id="lobby-map" key={lobby.mapId} defaultValue={lobby.mapId} disabled={!view.host || lobby.stage !== 'lobby'}>{RAID_MAPS.map(map => <option key={map.id} value={map.id}>{map.name}</option>)}</select></label><label className="row" style={{ margin: '15px 0' }}><input id="friendly-fire" type="checkbox" key={String(lobby.friendlyFire)} defaultChecked={lobby.friendlyFire} disabled={!view.host || lobby.stage !== 'lobby'} />Огонь по своим</label><div className="row"><button className={self?.ready ? '' : 'primary'} data-act="ready" disabled={lobby.stage !== 'lobby' || !view.connected}>{self?.ready ? 'Отменить готовность' : 'Я готов'}</button>{view.host && <button className="primary" data-act="start-room" disabled={!everyoneReady || lobby.stage !== 'lobby' || view.saving}>Начать общий рейд</button>}{lobby.stage === 'raid' && <button data-act="return-raid">Вернуться в рейд</button>}</div></section><aside className="panel stack"><span className="caps">Состояние связи</span><p className="network-state">{view.network}</p><p className="small">Не закрывайте вкладку хозяина во время рейда. Потерявший связь персонаж остаётся уязвимым.</p><button className="ghost" data-act="copy-network">Копировать диагностику</button><button className="danger" data-act="leave-room">Выйти из отряда</button></aside></div>}
  </section></>;
}

function SettingsScreen({ view }: { view: ViewModel }) {
  const settings = view.settings;
  return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><h1>Настройки</h1></div><div className="settings">
    <section className="panel"><h2>Изображение и звук</h2><div className="spacer" />
      <label>Чувствительность мыши<input type="range" id="sensitivity" min="0.0006" max="0.006" step="0.0001" defaultValue={settings.sensitivity} /></label>
      <label><span>Поле зрения · <span id="fov-value">{settings.fov}°</span></span><input type="range" id="fov" min="60" max="100" step="1" defaultValue={settings.fov} /></label>
      <label>Общая громкость<input type="range" id="volume" min="0" max="1" step="0.01" defaultValue={settings.volume} /></label>
      <label>Эффекты<input type="range" id="effects" min="0" max="1" step="0.01" defaultValue={settings.effects} /></label>
      <label>Разрешение рендера<select id="quality" defaultValue={settings.quality}><option value="high">Высокое — до 1,4×</option><option value="low">Низкое — 1×</option></select></label>
      <label className="row"><input id="bob" type="checkbox" defaultChecked={settings.bob} />Лёгкое покачивание оружия</label>
      <label className="row"><input id="voices" type="checkbox" defaultChecked={settings.voices} />Озвучка реплик голосом браузера</label>
      <p className="small">Озвучка доступна только при наличии русского системного голоса. Субтитры и звуковые эффекты работают независимо.</p>
    </section>
    <section className="panel"><h2>Управление</h2><p className="inventory-info">Щёлкните назначение и нажмите новую клавишу. Огонь — ЛКМ, прицел — ПКМ, меню — Escape.</p>
      <div className="bindings">{Object.entries(settings.bindings).map(([action, key]) => <button key={action} data-act="bind" data-id={action}>{bindingNames[action] || action}<span className="good">{key.replace('Key', '').replace('Digit', '')}</span></button>)}</div>
      <div className="divider" /><h3>Профиль</h3>{view.online ? <p className="inventory-info">Онлайн-профиль сохраняется на сервере. Для локального сохранения переключитесь в офлайн-режим через главное меню.</p> : <><div className="row" style={{marginTop:12}}><button data-act="export-profile" disabled={!view.profile || view.saving}>Экспорт профиля</button><button data-act="import-profile" disabled={view.saving || !!view.lobby}>Импорт профиля</button></div><p className="inventory-info">Профиль хранится в этом браузере и на этом адресе. Перед сменой домена экспортируйте сохранение.</p></>}
    </section>
  </div></section></>;
}

function CharacterScreen({ view }: { view: ViewModel }) {
  const creating = view.page === 'character';
  const appearance = normalizeAppearance(view.character.appearance, view.character.faction, view.character.outfit);
  const equipment = wardrobeEquipment(view.page, view.profile?.gear);
  const preset = APPEARANCE_PRESETS.find(entry => JSON.stringify(entry.appearance) === JSON.stringify(appearance))?.id || '';
  return <><Header view={view} /><section className="content ui-screen wardrobe-screen">
    <div className="page-head"><div><h1>{creating ? 'Новый персонаж' : 'Гардероб'}</h1><p className="small">Вся одежда и расцветки доступны бесплатно. Проверьте комплект в движении.</p></div></div>
    <div className="wardrobe-layout"><aside className="panel wardrobe-options"><div className="wardrobe-section">
      {creating ? <><label>Позывной<input id="character-name" maxLength={24} defaultValue={view.character.name} /></label><label>Фракция<select id="faction" defaultValue={view.character.faction}><option>BEAR</option><option>USEC</option></select></label></> : <><h2>{view.character.name}</h2><p className="small">{view.character.faction} · личное снаряжение</p></>}
      <label>Лицо<select id="face" key={'face-' + view.character.face} defaultValue={view.character.face}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>Вариант {index + 1}</option>)}</select></label>
      <label>Готовый комплект<select id="appearance-preset" key={preset} defaultValue={preset}><option value="">Своя комбинация</option>{APPEARANCE_PRESETS.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
    </div><div className="wardrobe-section">{wardrobeFields.map(field => <label key={field.key}>{field.name}<select id={'appearance-' + field.key} data-appearance={field.key} key={appearance[field.key]} defaultValue={appearance[field.key]}>{field.choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}</select></label>)}</div></aside>
    <div className="wardrobe-stage" aria-label="Предпросмотр персонажа"><div className="wardrobe-pose" role="group" aria-label="Проверка движения">{[['idle', 'Стойка'], ['walk', 'Шаг'], ['crouch', 'Присед']].map(([id, label]) => <button key={id} data-act="wardrobe-pose" data-id={id} aria-pressed={(view.wardrobePose || 'idle') === id} className={(view.wardrobePose || 'idle') === id ? 'selected' : ''}>{label}</button>)}</div><p className="wardrobe-caption small">Вращение — мышью · Масштаб — колесом</p></div>
    <aside className="panel wardrobe-summary"><h2>Ваш комплект</h2>{[['jacketCamo', 'Верх'], ['trouserCamo', 'Брюки'], ['rigCamo', 'Снаряжение'], ['backpackCamo', 'Рюкзак']].map(([field, label]) => {
      const camo = CAMOUFLAGES.find(entry => entry.id === appearance[field as keyof typeof appearance])!;
      return <div className="fabric-chip" key={field}><span style={{ backgroundImage: `url(${FABRIC_ASSETS[camo.id]})`, backgroundSize: 'cover' }} /><div><small>{label}</small><b>{camo.name}</b></div></div>;
    })}<div className="divider" /><h3>Защита</h3><p>{equipment?.armor ? CATALOG[equipment.armor.def].name : 'Бронежилет не надет'}</p><p>{equipment?.helmet ? CATALOG[equipment.helmet.def].name : 'Шлем не надет'}</p><p className="small">Броня и шлем надеваются в схроне. Одежда, разгрузка и внешний вид рюкзака не меняют защиту или вместимость.</p>
    {appearance.rig === 'rig_buyanov' && <p className="small">«Бронежилет Буянова» — пакет «Пельмени». Бронезащиты у полиэтилена нет.</p>}
    <div dangerouslySetInnerHTML={{ __html: patchControls(view) }} />
    <div className="wardrobe-actions"><button className="primary" data-act={creating ? 'create-character' : 'save-appearance'} disabled={view.saving || !!view.lobby}>{view.saving ? 'Сохранение…' : creating ? 'Создать персонажа' : 'Сохранить внешний вид'}</button><button className="ghost" data-act="wardrobe-buyanov">Пакет «Пельмени»</button><button className="ghost" data-act="reset-appearance">Сбросить выбор</button><button className="ghost" data-act="nav" data-id={creating ? 'main' : 'stash'}>Назад</button></div>
    {creating && <p className="small">Старт: {view.character.faction === 'BEAR' ? 'АК-74М' : 'M4A1'} + ПМ, лёгкая броня, патроны, медицина и 50 000 ₽.{view.profile && ' Замена профиля потребует резервной копии и подтверждения.'}</p>}
    </aside></div></section></>;
}

function InventoryGrid({ items, target, cols, rows, selected, cell }: { items: Item[]; target: string; cols: number; rows: number; selected: string; cell: string }) {
  const placement = pack(items, cols, rows);
  if (!placement) return <p className="bad">Нет места для размещения вещей.</p>;
  const byId = new Map(items.map(item => [item.id, item]));
  return <div className="grid drop" data-target={target} style={{ '--cols': cols, '--rows': rows, '--cell': cell } as CSSProperties}>
    {placement.map(position => {
      const item = byId.get(position.id)!;
      const definition = CATALOG[item.def];
      return <button key={item.id} draggable data-item={item.id} data-act="select-item" data-id={item.id} data-search={definition.name.toLowerCase()} title={`${definition.name}${item.qty > 1 ? ` × ${item.qty}` : ''}`} aria-label={definition.name} className={`item rarity${definition.rarity} ${selected === item.id ? 'selected' : ''}`} style={{ gridColumn: `${position.x + 1}/span ${position.w}`, gridRow: `${position.y + 1}/span ${position.h}` }}>
        <span className="item-icon" dangerouslySetInnerHTML={{ __html: icon(item) }} /><span className="abbr">{definition.name}</span>{isMagazine(item) ? <span className="qty">{item.rounds}</span> : item.qty > 1 ? <span className="qty">{item.qty}</span> : null}
      </button>;
    })}
  </div>;
}

function ItemInspect({ item, saving }: { item: Item; saving: boolean }) {
  const definition = CATALOG[item.def];
  const trader = TRADERS.findIndex(contact => contact.categories.includes(definition.category));
  return <section className="inspect"><div className="divider" /><span className="item-icon" dangerouslySetInnerHTML={{ __html: icon(item) }} />
    <h3>{definition.name}{item.qty > 1 ? ` × ${item.qty}` : ''}</h3>
    <p className="small">{definition.description}</p>{definition.joke && <p className="item-joke">{definition.joke}</p>}
    <p className="inventory-info">{weight([item]).toFixed(2)} кг · сохранность {item.condition}%{item.found ? ' · найдено в рейде' : ''}{item.bound ? ' · нельзя продать' : ''}{definition.category === 'armor' && ` · поглощение ${Math.round(armorAbsorption(item) * 100)}%`}</p>
    <div className="row">
      <button data-act="move" data-id="stash" disabled={saving}>В схрон</button><button data-act="move" data-id="bag" disabled={saving}>В рюкзак</button>
      {['documents', 'valuables'].includes(definition.category) && <button data-act="move" data-id="safe" disabled={saving}>Защитить</button>}
      {definition.category === 'weapon' && <><button data-act="move" data-id="primary" disabled={saving}>Основное</button><button data-act="move" data-id="secondary" disabled={saving}>Второе</button><button data-act="edit-gun" data-id={item.id}>В оружейную</button></>}
      {definition.category === 'armor' && <button data-act="move" data-id={equipmentSlot(definition) || 'armor'} disabled={saving}>Надеть</button>}
      {(isMagazine(item) || item.children.magazine) && <><p className="small">Магазин: {isMagazine(item) ? item.rounds : feedRounds(item)} / {isMagazine(item) ? magazineCapacity(item) : calculateStats(item).capacity}{!isMagazine(item) && ` · патронник: ${item.chamber || 0}`}</p><button data-act="pack-mag" data-id={item.id} disabled={saving}>Зарядить</button><button data-act="unload-mag" data-id={item.id} disabled={saving}>Разрядить</button></>}
      <button data-act="rotate" disabled={saving}>Повернуть</button>{item.qty > 1 && <button data-act="split" disabled={saving}>Разделить</button>}
      <button data-act="sell" data-id={trader} disabled={!!item.bound || saving}>Продать · {money(value(item, TRADERS[trader].sell))}</button>
    </div>
  </section>;
}

function StashScreen({ view }: { view: ViewModel }) {
  const profile = view.profile!;
  const selected = [...profile.stash, ...profile.inbox, ...flatGear(profile.gear)].find(item => item.id === view.selected);
  const slots = [['primary', 'Основное оружие'], ['secondary', 'Второе оружие'], ['armor', 'Броня'], ['helmet', 'Шлем']] as const;
  const risk = flatGear({ ...profile.gear, safe: [] }).reduce((sum, item) => sum + value(item), 0);
  return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><div><h1>Схрон</h1><p className="small">Экипировка справа и слева отправится в рейд. Содержимое схрона останется дома.</p></div></div><div className="gear-layout">
    <aside className="panel"><span className="caps">Экипировка</span><div className="spacer" />{slots.map(([slot, label]) => {
      const item = profile.gear[slot];
      return <div className="drop" data-target={slot} key={slot}><button className={`equip-slot ${view.selected === item?.id ? 'selected' : ''}`} data-act="select-item" data-id={item?.id || ''}>{item ? <span dangerouslySetInnerHTML={{ __html: icon(item) }} /> : <span className="muted">—</span>}<span className="small muted">{label}<b>{item ? CATALOG[item.def].name : 'Пусто'}</b></span></button></div>;
    })}<div className="divider" /><h3>Защищённый контейнер</h3><p className="inventory-info">Ценности и документы сохраняются при смерти.</p><InventoryGrid items={profile.gear.safe} target="safe" cols={2} rows={2} selected={view.selected} cell="43px" /><p className="inventory-info">Общая масса: {weight(flatGear(profile.gear)).toFixed(1)} кг<br />Стоимость риска: {money(risk)}</p><button className="primary" data-act="nav" data-id="maps">В рейд</button></aside>
    <section className="panel"><div className="row between"><h2>Схрон</h2><span className="small muted">10 × 16</span></div><div className="row stash-search" style={{ margin: '12px 0' }}><input id="search" defaultValue={view.search} placeholder="Поиск вещей" aria-label="Поиск вещей" /><button className="ghost" data-act="sort">Сортировать</button></div><InventoryGrid items={profile.stash} target="stash" cols={10} rows={16} selected={view.selected} cell="clamp(25px,3.3vh,37px)" />{profile.inbox.length > 0 && <><div className="divider" /><h3>Приём добычи · {profile.inbox.length}</h3><p className="small">Вещи сохранены. Освободите место или продайте их.</p><div className="container-items">{profile.inbox.map(item => <button data-act="select-item" data-id={item.id} key={item.id}><span dangerouslySetInnerHTML={{ __html: icon(item) }} />{CATALOG[item.def].name}</button>)}</div></>}</section>
    <aside className="panel"><div className="row between"><h2>Рюкзак</h2><span className="small muted">6 × 6</span></div><p className="inventory-info">{weight(profile.gear.bag).toFixed(1)} / 24 кг · Переносите вещи мышью или кнопками.</p><InventoryGrid items={profile.gear.bag} target="bag" cols={6} rows={6} selected={view.selected} cell="35px" />{selected ? <ItemInspect item={selected} saving={view.saving} /> : <p className="inventory-info">Выберите предмет для осмотра, переноса или продажи.</p>}</aside>
  </div></section></>;
}

function GunsmithScreen({ view }: { view: ViewModel }) {
  const profile = view.profile!;
  const guns = [profile.gear.primary, profile.gear.secondary, ...profile.stash.filter(item => CATALOG[item.def].category === 'weapon')].filter((item): item is Item => !!item);
  const gun = view.preview;
  if (!gun) return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><h1>Оружейная</h1></div><section className="panel"><p>Сначала купите оружие или получите аварийный комплект у торговца.</p><button data-act="nav" data-id="traders">К торговцам</button></section></section></>;
  const stats = calculateStats(gun);
  const slots = getSlots(gun);
  const slot = slots.find(candidate => candidate.path === view.slot) || slots[0];
  let cost = 0;
  let problem = '';
  let missing: string[] = [];
  try {
    const quote = quoteBuild(profile, view.original!, presetOf(gun));
    cost = quote.cost;
    missing = quote.missing;
  } catch (error) { problem = (error as Error).message; }
  const ownCount = (id: string) => walk(view.original!).filter(node => node.item.def === id).length + profile.stash.filter(item => CATALOG[item.def].category === 'module').flatMap(item => walk(item)).filter(node => node.item.def === id).length;
  const compatible = slot ? MODULES.map(module => ({ module, problems: moduleProblems(gun, slot.path, module.id) })).filter(entry => view.showIncompatible || !entry.problems.length).sort((a, b) => Number(!!a.problems.length) - Number(!!b.problems.length) || ownCount(b.module.id) - ownCount(a.module.id) || a.module.price - b.module.price) : [];
  const authored = WORKSHOP_PRESETS.filter(preset => preset.tree.def === gun.def);
  const dirty = JSON.stringify(presetOf(gun)) !== JSON.stringify(presetOf(view.original!));
  return <><Header view={view} /><section className="content ui-screen gunsmith-screen"><div className="page-head"><div><h1>Оружейная</h1><p className="small">{CATALOG[gun.def].name}{dirty && ' · Несохранённая сборка'}</p></div></div><div className="weapon-layout">
    <aside className="panel"><span className="caps">Ваше оружие</span><div className="weapon-list">{guns.map(item => <button key={item.id} data-act="choose-gun" data-id={item.id} className={item.id === view.original?.id ? 'selected' : ''}><span dangerouslySetInnerHTML={{ __html: icon(item) }} />{CATALOG[item.def].name}</button>)}</div><div className="slot-list">{slots.map(candidate => <button key={candidate.path} data-act="slot" data-id={candidate.path} className={candidate.path === slot?.path ? 'selected' : ''}>{candidate.slot.name}<small>{candidate.item ? CATALOG[candidate.item.def].name : 'Не установлено'}</small></button>)}</div><div className="divider" /><span className="caps">Сборки мастерской</span><div className="preset-list" style={{ marginTop: 10 }}>{authored.map(preset => <button key={preset.id} data-act="workshop-preset" data-id={preset.id}>{preset.name}<small>{preset.description}</small></button>)}</div><div className="divider" /><span className="caps">Ваши пресеты</span><div className="preset-list" style={{ marginTop: 10 }}>{profile.presets.filter(preset => preset.def === gun.def).map(preset => <button key={preset.name} data-act="load-preset" data-id={preset.name}>{preset.name}</button>)}</div><div className="row" style={{ marginTop: 10 }}><button data-act="save-preset">Сохранить</button><button data-act="export-preset">Экспорт</button><button data-act="import-preset">Импорт</button></div></aside>
    <div className="viewport-actions"><p className="small muted">Вращение — мышь · Масштаб — колесо · Деталь — щелчок по модели</p><div className="row"><button className="ghost" data-act="reset-view">Вернуть вид</button><button className="ghost" data-act="explode">Разнести детали</button><button data-act="range" disabled={dirty || !!view.lobby}>В тир</button></div><div className="weapon-stats">{[[`${stats.weight.toFixed(2)} кг`, 'Масса'], [stats.ergo.toFixed(0), 'Эргономика'], [stats.recoil.toFixed(2), 'Отдача'], [`${(stats.ads * 1000).toFixed(0)} мс`, 'Прицеливание'], [String(stats.capacity), 'Магазин']].map(([value, label]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div><div className="row"><button data-act="reset-build" disabled={!dirty}>Сбросить</button><button data-act="apply-owned" disabled={!dirty || !!missing.length || !!problem || view.saving || !!view.lobby}>Из своих деталей</button><button className="primary" data-act="apply-build" disabled={!dirty || !!problem || view.saving || !!view.lobby}>{cost ? `Купить недостающее · ${money(cost)}` : 'Применить сборку'}</button></div>{problem && <p className="bad small">{problem}</p>}{missing.length > 0 && <p className="small">Не хватает: {missing.map(id => CATALOG[id].name).join(', ')}.</p>}{dirty && <p className="small">Сначала примените сборку, затем переходите в тир.</p>}</div>
    <aside className="panel"><span className="caps">Выбранный слот</span><h2 style={{ marginTop: 10 }}>{slot?.slot.name || 'Детали'}</h2><p className="small" style={{ marginTop: 9 }}>{slot?.path.includes('.') ? 'Крепится к установленному родительскому модулю.' : 'Доступны только совместимые игровые интерфейсы.'}</p><div className="row" style={{ margin: '10px 0' }}><button className="ghost" data-act="show-incompatible">{view.showIncompatible ? 'Скрыть несовместимые' : 'Показать несовместимые'}</button></div><div className="module-list">{slot && !slot.slot.required && <button data-act="module" data-id="none" className={!slot.item ? 'selected' : ''}>Без детали</button>}{compatible.map(({ module, problems }) => {
      const owned = ownCount(module.id);
      return <button key={module.id} data-act="module" data-id={module.id} className={slot?.item?.def === module.id ? 'selected' : ''} disabled={!!problems.length}>{module.name}<small>{problems.length ? problems[0] : `${owned ? 'Есть в текущей сборке / схроне' : money(Math.ceil(module.price * 1.2))} · ${module.weight.toFixed(2)} кг`}</small></button>;
    })}</div><div className="divider" /><p className="small">Это самостоятельные виртуальные детали. Их игровые соединения не являются инструкцией для настоящего оружия.</p></aside>
  </div></section></>;
}

function QuestsScreen({ view }: { view: ViewModel }) {
  const profile = view.profile!;
  return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><div><h1>Задания</h1><p className="small">Принимайте до рейда. Покупки у торговцев не считаются находками.</p></div></div><div className="quests">
    {QUESTS.map(quest => {
      const state = profile.quests[quest.id];
      const count = quest.kind === 'deliver' ? profile.stash.filter(item => item.def === quest.target && item.found && item.foundMap === quest.map).reduce((sum, item) => sum + item.qty, 0) : state?.progress || 0;
      const instruction = quest.kind === 'deliver' ? 'Передать найденное: ' : quest.kind === 'extract' ? 'Найти и вынести: ' : quest.kind === 'visit' ? 'Посетить и эвакуироваться: ' : 'Изменить сборку и сделать выстрел в тире';
      const target = quest.kind === 'test' ? '' : CATALOG[quest.target]?.name || MAPS[quest.map]?.pois.find(point => point.id === quest.target)?.name || quest.target;
      return <article className="panel quest" key={quest.id}><span className="caps">{MAPS[quest.map]?.name || 'Тир'}</span><h2>{quest.name}</h2><p className="small">{instruction}{target}{quest.count > 1 ? ` × ${quest.count}` : ''}.</p><div className="row between"><span className={`small ${count >= quest.count ? 'good' : 'muted'}`}>{state ? `${Math.min(count, quest.count)} / ${quest.count}` : 'Не принято'}</span><b className="small">{money(quest.reward)}</b></div><button className={!state ? 'primary' : ''} data-act="quest" data-id={quest.id} disabled={!!state?.claimed || view.saving}>{state?.claimed ? 'Выполнено' : state ? 'Получить награду' : 'Принять'}</button></article>;
    })}
  </div></section></>;
}

function MapsScreen({ view }: { view: ViewModel }) {
  const profile = view.profile!;
  const risk = flatGear({ ...profile.gear, safe: [] }).reduce((sum, item) => sum + value(item), 0);
  const gun = profile.gear.primary || profile.gear.secondary;
  return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><div><h1>Выход в рейд</h1><p className="small">Выберите маршрут. Для эвакуации останьтесь в зелёной зоне на 8 секунд.</p></div></div>
    <div className="map-list">{RAID_MAPS.map(map => <button className={`map-card ${map.id === view.mapId ? 'selected' : ''}`} data-act="map" data-id={map.id} key={map.id}><span dangerouslySetInnerHTML={{ __html: mapSvg(map) }} /><h3>{map.name}</h3><p>{map.subtitle}</p><p className="small" style={{marginTop:9}}>{map.size[0]} × {map.size[1]} м · {Math.round(map.duration / 60)} мин · {map.exits.length} выходов</p></button>)}</div>
    <section className="panel deploy-panel"><div><h2>{gun ? CATALOG[gun.def].name : 'Оружие не выбрано'}</h2><p style={{marginTop:7}}>Риск: {money(risk)} · {weight(flatGear(profile.gear)).toFixed(1)} кг{gun ? ` · заряжено ${loadedRounds(gun)}/${calculateStats(gun).capacity} · запас ${availableRounds(profile.gear, gun)}` : ''}</p>{gun && !loadedRounds(gun) && <p className="bad small">Оружие не заряжено.</p>}{gun && !availableRounds(profile.gear, gun) && <p className="bad small">{detachable(gun) ? 'В рюкзаке нет заряженных запасных магазинов.' : 'В рюкзаке нет подходящих патронов.'}</p>}<p className="small">Шесть выходов открыты всегда; ещё три требуют включения пульта или пропуска. Escape не останавливает рейд.</p></div><div className="stack"><button className="primary" data-act={view.lobby ? 'nav' : 'solo'} data-id={view.lobby ? 'lobby' : ''} disabled={!gun || view.saving}>{view.lobby ? 'Перейти в отряд' : 'Начать одиночный рейд'}</button><button className="ghost" data-act="nav" data-id="lobby">Пригласить друга</button></div></section>
  </section></>;
}

function TradersScreen({ view }: { view: ViewModel }) {
  const profile = view.profile!;
  const trader = TRADERS[view.trader];
  const definitions = [...WEAPONS, ...MODULES, ...AMMO, ...ARMOR, ...LOOT].filter(definition => trader.categories.includes(definition.category));
  const sellable = profile.stash.filter(item => trader.categories.includes(CATALOG[item.def].category));
  return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><h1>Торговцы</h1></div><div className="trade-layout">
    <aside className="panel"><span className="caps">Контакты</span>{TRADERS.map((contact, index) => <button className={`trader ${index === view.trader ? 'selected' : ''}`} data-act="trader" data-id={index} key={contact.name}><b>{contact.name}</b><small>{['Оружейник', 'Снабжение и медицина', 'Техника и хозяйственные вещи'][index]}</small></button>)}<div className="divider" /><p className="small">Покупки поступают в схрон. Перед рейдом переместите нужные вещи в экипировку.</p><div className="spacer" /><button className="ghost" data-act="rescue">Аварийный комплект</button><p className="small">Для оставшегося без оружия и денег на пистолет. Комплект нельзя продать.</p></aside>
    <section className="panel"><div className="row between"><h2>{trader.name}</h2><span className="small muted">Купить</span></div><input id="search" style={{marginTop:15}} placeholder="Поиск в ассортименте" aria-label="Поиск в ассортименте" defaultValue={view.search} /><div className="goods">{definitions.map(definition => {
      const quantity = definition.category === 'ammo' ? 30 : 1;
      const item = definition.category === 'weapon' ? createWeapon(definition.id, false) : createItem(definition.id, quantity);
      const label = definition.category === 'ammo' ? '30 патронов' : definition.category === 'weapon' ? 'Комплектная сборка' : definition.category === 'module' ? 'Отдельная деталь' : definition.effect ? 'Расходуемый предмет' : 'Добыча / задача';
      return <article className="good-row" data-search={definition.name.toLowerCase()} key={definition.id}><span dangerouslySetInnerHTML={{ __html: icon(item) }} /><div><b>{definition.name}</b><small>{label}</small></div><div className="good-actions">{definition.category === 'weapon' && <button className="ghost" data-act="catalog-range" data-id={definition.id} disabled={view.saving || !!view.lobby}>Испытать</button>}<button data-act="buy" data-id={definition.id} disabled={view.saving}>{money(purchaseCost(item, trader.buy))}</button></div></article>;
    })}</div></section>
    <aside className="panel"><h2>Продать из схрона</h2><p className="inventory-info">Торговец покупает только свой ассортимент.</p><div className="container-items">{sellable.length ? sellable.map(item => <button data-act="sell-direct" data-id={item.id} disabled={!!item.bound || view.saving} key={item.id}><span dangerouslySetInnerHTML={{ __html: icon(item) }} /><span>{CATALOG[item.def].name}<br /><small>{money(value(item, trader.sell))}</small></span></button>) : <p className="small">Нет подходящих вещей.</p>}</div></aside>
  </div></section></>;
}

function ResultsScreen({ view }: { view: ViewModel }) {
  const result = view.result;
  if (!result) return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><h1>Результат</h1></div><p>Нет завершённого рейда.</p></section></>;
  const outcome = { extracted: 'Эвакуирован', dead: 'Погиб', missing: 'Пропал', technical: 'Технический обрыв' }[result.outcome];
  const loot = flatGear(result.gear).filter(item => item.found === result.raidId);
  return <><Header view={view} /><section className="content ui-screen"><section className="panel result">
    <span className="caps">{MAPS[result.map]?.name || result.map} · Результат рейда</span>
    <h1 className={result.outcome === 'extracted' ? 'good' : result.outcome === 'technical' ? '' : 'bad'}>{outcome}</h1>
    {result.cause && <p>{result.cause}</p>}
    <p>{result.outcome === 'extracted' ? 'Снаряжение сохранено, найденные в рюкзаке вещи отправлены в схрон.' : result.outcome === 'technical' ? 'Возвращён предрейдовый комплект. Добыча из прерванного рейда не начислена.' : 'Содержимое схрона не затронуто. Сохранён только защищённый контейнер.'}</p>
    <div className="result-stats"><div><b>{timeText(result.seconds)}</b><span>Время в рейде</span></div><div><b>{result.kills}</b><span>Побеждённые дикие</span></div><div><b>{result.outcome === 'extracted' ? money(loot.reduce((sum, item) => sum + value(item, .5), 0)) : '—'}</b><span>Оценка продажи добычи</span></div></div>
    <div className="result-loot">{result.outcome === 'extracted' && loot.map(item => <div className="good-row" key={item.id}><span dangerouslySetInnerHTML={{ __html: icon(item) }} /><div><b>{CATALOG[item.def].name}</b><small>{money(value(item, .5))}</small></div></div>)}</div>
    <div className="footer-actions">{view.snapshot?.players.some(actor => actor.id !== view.profile?.id && actor.status === 'active') && <button data-act="spectate">Наблюдать за напарником</button>}{view.profile?.pending && !view.saving && <button data-act="retry-result">Повторить сохранение</button>}<button className="primary" data-act="result-continue" disabled={view.saving || !!view.profile?.pending}>{view.saving ? 'Сохранение…' : 'Продолжить'}</button></div>
  </section></section></>;
}

function RaidOverlay({ view }: { view: ViewModel }) {
  const snapshot = view.snapshot;
  const actor = snapshot?.players.find(player => player.id === view.profile?.id);
  if (!snapshot || !actor || !view.overlay) return null;
  const map = MAPS[snapshot.mapId];

  if (view.overlay === 'inventory') {
    const container = snapshot.containers.find(candidate => candidate.id === view.containerId);
    const selected = actor.gear.bag.find(item => item.id === view.selected);
    const browsable = !container || container.loose || !container.items.length || container.searchedBy?.includes(actor.id);
    const busy = actor.reload > 0 || actor.use > 0 || !!actor.inspect || !!actor.search;
    const searching = actor.search && actor.searchTarget === container?.id;
    const contents = container
      ? browsable
        ? container.items.length
          ? container.items.map(item => <button key={item.id} data-act="take" data-id={item.id} disabled={busy}>
              <span dangerouslySetInnerHTML={{ __html: icon(item) }} />
              <span>{CATALOG[item.def].name}{item.qty > 1 ? ' × ' + item.qty : ''}</span>
              <span className="small">Забрать</span>
            </button>)
          : <p>Пусто. Кто-то уже забрал содержимое.</p>
        : searching
          ? <><p role="status">Обыск · {actor.search!.toFixed(1)} с</p><progress aria-label="Обыск контейнера" max={actor.searchDuration || 1} value={(actor.searchDuration || 1) - (actor.search || 0)} /><button data-act="cancel-action">Прервать обыск</button></>
          : <><p>Содержимое ещё не осмотрено.</p><button data-act="search-container" data-id={container.id} disabled={busy}>Обыскать</button></>
      : actor.gear.bag.filter(item => CATALOG[item.def].effect).map(item => <button key={item.id} data-act="use" data-id={item.id} disabled={busy}>{CATALOG[item.def].name}</button>);
    const activeMagazine = actor.gear[actor.active]?.children.magazine;
    return <div className="overlay" role="dialog" aria-modal="true" aria-label="Рюкзак"><section className="panel raid-inventory">
      <h2>Рюкзак <span className="small muted">{weight(actor.gear.bag).toFixed(1)} / 24 кг · рейд продолжается</span></h2>
      <div className="raid-inventory-status"><div className="raid-condition" dangerouslySetInnerHTML={{ __html: conditionHtml(actor) }} />
        {actor.use > 0 && <><p role="status">{useLabel(actor)} · {actor.use.toFixed(1)} с</p><button data-act="cancel-action">Прервать</button></>}
        <span className="small">{carriedWeightText(actor)}</span>
      </div>
      <div><InventoryGrid items={actor.gear.bag} target="raidbag" cols={6} rows={6} selected={view.selected} cell="54px" />
        <div className="row" style={{ marginTop: 10 }}>
          {selected && CATALOG[selected.def].effect && <button data-act="use" data-id={selected.id}>Использовать</button>}
          {selected && isMagazine(selected) && <>
            <button data-act="raid-pack-mag" data-id={selected.id}>Зарядить · {selected.rounds}/{magazineCapacity(selected)}</button>
            {actor.gear[actor.active] && compatibleMagazine(actor.gear[actor.active]!, selected) && <button data-act="raid-swap-mag" data-id={selected.id} disabled={selected.rounds === 0}>Вставить</button>}
          </>}
          {selected && <button data-act="drop" data-id={selected.id}>Выбросить</button>}
          {activeMagazine && <button data-act="raid-pack-mag" data-id={activeMagazine.id}>Зарядить установленный</button>}
        </div>
      </div>
      <div><h3>{container?.name || 'Быстрые действия'}</h3><div className="container-items">{contents}</div><div className="spacer" />
        <p className="small">{view.online ? 'Взятие подтверждает сервер.' : 'Взятие подтверждает создатель отряда.'} R меняет заряженный магазин. Патронник сохраняется отдельно. Снятый магазин остаётся в рюкзаке. Зарядка россыпью прерывается движением или огнём.</p>
      </div>
      <div className="row" style={{ gridColumn: '1/-1', justifyContent: 'flex-end' }}><button className="primary" data-act="resume">Вернуться в игру</button></div>
    </section></div>;
  }

  if (view.overlay === 'map') {
    return <div className="overlay" role="dialog" aria-modal="true" aria-label="Карта и выходы"><section className="panel map-overlay">
      <h2>{map.name}</h2><div className="map-detail"><div>
        <div dangerouslySetInnerHTML={{ __html: mapSvg(map, actor, true, snapshot.activated, view.trackedExit) }} />
        <p className="small">Светлая стрелка — вы. Маркеры показывают доступные и закрытые выходы; квадрат — управление доступом. Пунктиром выделена ваша цель.</p>
      </div><aside className="stack"><h3>Куда эвакуироваться</h3>
        {map.exits.map(exit => {
          const guide = exitGuidance(map, actor, exit.id, snapshot.activated)!;
          return <button key={exit.id} className={'exit-choice' + (view.trackedExit === exit.id ? ' selected' : '')} data-act="track-exit" data-id={exit.id}>
            <b>{exit.name}</b><small>{Math.round(guide.distance)} м по прямой · {guide.available ? 'доступен' : 'закрыт'}</small>
            {!guide.available && <small>Открыть: {map.activators?.find(item => item.id === exit.requires)?.name || 'найдите управление доступом'}</small>}
            <small>{view.trackedExit === exit.id ? 'Отмечен на компасе' : 'Отметить на компасе'}</small>
          </button>;
        })}
        {view.trackedExit && <button className="ghost" data-act="track-exit" data-id="">Снять отметку</button>}
        <p className="small">Компас показывает направление и прямое расстояние. Проходы между зданиями выбирайте по карте.</p>
      </aside></div><div className="footer-actions"><button className="primary" data-act="resume">Вернуться в игру</button></div>
    </section></div>;
  }

  return <div className="overlay" role="dialog" aria-modal="true" aria-label="Рейдовое меню"><section className="panel modal">
    <span className="caps">{view.isRange ? 'Тренировочный тир' : 'Рейд продолжается'}</span>
    <h2 style={{ marginTop: 10 }}>{actor.status === 'active' ? 'Продолжить?' : 'Рейд вашего персонажа завершён'}</h2>
    <p>{view.isRange ? 'Проверяйте установленную сборку по мишеням. Результаты стрельбы не меняют имущество.' : 'Escape освобождает курсор, но не останавливает мир. Для сохранения добычи доберитесь до выхода и стойте внутри зоны на земле до завершения отсчёта. Прыжок прерывает эвакуацию.'}</p>
    <div className="stack"><button className="primary" data-act="resume">{actor.status === 'active' ? 'Вернуться в игру' : 'Наблюдать'}</button>
      {!view.isRange && actor.status === 'active' && <button data-act="raid-inventory">Инвентарь</button>}
      {!view.isRange && <button data-act="raid-map">Карта и выходы</button>}
      {view.isRange ? <button data-act="leave-range">Вернуться в оружейную</button> : actor.status !== 'active' ? <button data-act="show-result">К результату</button> : <button className="danger" data-act="abandon">Покинуть рейд с потерей вещей</button>}
    </div>
  </section></div>;
}

function RaidHud({ view }: { view: ViewModel }) {
  const snapshot = view.snapshot;
  const actor = snapshot?.players.find(player => player.id === view.profile?.id);
  if (!snapshot || !actor) return <section className="loading"><h2>Ожидание состояния рейда</h2></section>;
  const map = MAPS[snapshot.mapId];
  const gun = actor.gear[actor.active];
  const network = view.isRange ? 'ТИР · БЕЗ ПОТЕРИ СНАРЯЖЕНИЯ' : view.lobby ? `ОТРЯД · ${view.lobby.members.length} / ${view.lobby.capacity || view.lobby.members.length}` : 'ОДИНОЧНЫЙ РЕЙД';
  const hints = [keyLabel(view.settings, 'interact') + ' · взаимодействие', keyLabel(view.settings, 'inventory') + ' · рюкзак', keyLabel(view.settings, 'map') + ' · карта', keyLabel(view.settings, 'slow') + ' · тихий шаг'];
  return <><section className="hud" id="hud">
    <div className="hud-top"><b>{map.name}</b><span className="timer" id="hud-time">{timeText(map.duration - snapshot.time)}</span><span className="small" id="hud-network">{network}</span></div>
    <div className="raid-compass"><b id="hud-heading">{headingText(actor.yaw)}</b>{!view.isRange && <small id="hud-guide">{guidanceText(map, actor, view.trackedExit || '', snapshot.activated)}</small>}</div>
    <div id="hud-minimap" className="minimap" dangerouslySetInnerHTML={{ __html: mapSvg(map, actor, false, snapshot.activated, view.trackedExit) }} />
    <div id="hud-objectives" className="raid-objectives" dangerouslySetInnerHTML={{ __html: objectivesHtml(view.profile!, actor, snapshot.mapId, snapshot.raidId) }} />
    <div id="scope" /><div id="crosshair" className="crosshair" />
    <div className="hud-bottom"><div className="vital"><span id="hud-hp" className="num">{Math.ceil(actor.hp)}</span> <span className="label">ЗДОРОВЬЕ</span><div className="bar"><i id="health-bar" style={{ width: `${actor.hp}%` }} /></div><div className="bar stamina" aria-label="Выносливость"><i id="stamina-bar" style={{ width: `${actor.stamina}%` }} /></div><div id="hud-condition" className="raid-condition" dangerouslySetInnerHTML={{ __html: conditionHtml(actor) }} /><small id="hud-weight">{carriedWeightText(actor)}</small></div></div>
    <div className="raid-controls"><div className="quickslots" id="hud-quickslots" dangerouslySetInnerHTML={{ __html: quickslotsHtml(actor, view.settings) }} /><div className="raid-keyhint">{hints.join('   ')}</div></div>
    <div className="ammo"><b id="hud-ammo">{gun ? `${feedRounds(gun)} + ${gun.chamber || 0}` : '0'}</b><span id="hud-reserve"> / {gun ? availableRounds(actor.gear, gun) : 0}</span><small id="hud-gun">{gun ? CATALOG[gun.def].name : 'Без оружия'}</small><small id="hud-action" /></div>
    <div id="interaction" className="interaction" hidden /><div id="extraction" className="extracting" hidden /><div id="subtitle" className="subtitle" hidden /><div id="injury" /><div id="teammate-labels" />
  </section><div id="raid-overlay"><RaidOverlay view={view} /></div></>;
}

function AboutScreen({ view }: { view: ViewModel }) {
  return <><Header view={view} /><section className="content ui-screen"><div className="page-head"><h1>Об игре</h1></div><section className="panel about">
    <h2>РЕЙД · обновлённая сборка</h2>
    <p>Самостоятельный низкополигональный PvE extraction-шутер. В этой сборке: {WEAPONS.length} основ оружия, {MODULES.length} виртуальных модулей, {LOOT.length} самостоятельных предметов добычи, пять компактных игровых уровней и тир.</p>
    <p>Модели, иконки и звуковые эффекты создаются собственным кодом. Ассеты Escape from Tarkov и Unturned не используются. BEAR и USEC остаются обозначениями исходной фанатской задумки; проект не связан с правообладателями.</p>
    <p>Текущий браузерный клиент использует React для интерфейса и Babylon.js для 3D-графики. {view.online ? 'Закрытый PvE-отряд принимает до пяти игроков. Рейд и онлайн-профиль ведёт сервер; после разрыва есть 60 секунд на переподключение.' : 'Офлайн-профиль хранится в этом браузере. Старый WebRTC-отряд в офлайн-режиме оставлен для совместимости, его симуляция работает у создателя.'}</p>
    <p>Добавлены травмы от высоких падений, шина, истощение, поиск ботами и компас с целью эвакуации. Полное ТЗ ещё не завершено: карты компактнее целевых, нет актёрских записей и полной проверки интернет-кооператива. Детали — оригинальные виртуальные, а не проверенный каталог брендовых реплик. Магазины имеют отдельные экземпляры и боекомплект; старые локальные профили мигрируют с резервной копией.</p>
    <p>Шрифт интерфейса — установленный системный. В комплекте инструмента сборки используется TypeScript под лицензией Apache-2.0; игра не загружает его в браузер.</p>
    <div className="divider" /><button className="primary" data-act="nav" data-id="main">В меню</button>
  </section></section></>;
}

export function Screen({ view }: { view: ViewModel }) {
  if (view.page === 'loading') return <section className="loading"><span className="caps">Подготовка рейда</span><h2>{MAPS[view.mapId]?.name || 'РЕЙД'}</h2><div className="progress" /><p>Загрузка карты, сохранение экипировки и проверка готовности.</p></section>;
  if (view.page === 'main') return <Menu view={view} />;
  if (view.page === 'lobby' && view.online) return <OnlineLobby view={view} />;
  if (view.page === 'lobby') return <OfflineLobby view={view} />;
  if (view.page === 'settings') return <SettingsScreen view={view} />;
  if ((view.page === 'character' || view.page === 'wardrobe')) return <CharacterScreen view={view} />;
  if (view.page === 'stash') return <StashScreen view={view} />;
  if (view.page === 'gunsmith') return <GunsmithScreen view={view} />;
  if (view.page === 'quests') return <QuestsScreen view={view} />;
  if (view.page === 'maps') return <MapsScreen view={view} />;
  if (view.page === 'traders') return <TradersScreen view={view} />;
  if (view.page === 'results') return <ResultsScreen view={view} />;
  if (view.page === 'raid') return <RaidHud view={view} />;
  if (view.page === 'about') return <AboutScreen view={view} />;
  return <div className="react-screen" dangerouslySetInnerHTML={{ __html: screen(view) }} />;
}
