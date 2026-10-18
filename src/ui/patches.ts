import type { ViewModel } from './views.js';
import { PATCH_SLOTS, isPatchId } from '../domain/patches.js';
import { esc } from './helpers.js';

/** Shared markup keeps the legacy and React wardrobe actions identical. */
export function patchControls(view: ViewModel): string {
    const library = (view.patchLibrary || []).filter(patch => isPatchId(patch.id)), disabled = view.patchBusy || view.saving || !!view.lobby;
    return `<section class="patch-panel" aria-labelledby="patch-title"><h3 id="patch-title">Плечевые патчи</h3><p class="small" id="patch-help">PNG, JPEG или WebP до 2 МиБ. До 20 изображений в библиотеке.</p>
    <label>Добавить изображение<input id="patch-upload" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="patch-help" ${disabled ? 'disabled' : ''}></label>
    ${PATCH_SLOTS.map((slot, index) => `<label>${index ? 'Правое плечо' : 'Левое плечо'}<select id="patch-${slot}" data-patch-slot="${slot}" ${disabled ? 'disabled' : ''}><option value="">Без патча</option>${library.map((patch, n) => `<option value="${patch.id}" ${view.character.patches?.[slot] === patch.id ? 'selected' : ''}>Патч ${n + 1}</option>`).join('')}</select></label>`).join('')}
    <div class="patch-library">${library.map((patch, index) => `<div class="patch-library-item">${view.patchUrls?.[patch.id] ? `<img src="${esc(view.patchUrls[patch.id])}" alt="Патч ${index + 1}" width="64" height="64">` : '<span class="small">Загрузка…</span>'}<span>Патч ${index + 1}</span><button data-act="delete-patch" data-id="${patch.id}" ${disabled || Object.values(view.character.patches || {}).includes(patch.id) ? 'disabled' : ''} aria-label="Удалить патч ${index + 1}">Удалить</button></div>`).join('')}</div>
    ${!library.length ? '<p class="small">Добавьте изображение, затем выберите плечо.</p>' : ''}
    <p class="small" role="status">${view.patchBusy ? 'Обработка изображения…' : esc(view.patchError || '')}</p></section>`;
}
