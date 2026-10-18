import { geometry } from '../rendering/geometry.js';
import type { Item, MapDef, Vec3 } from '../domain/types.js';
import { isMagazine } from '../domain/ammunition.js';
import { CATALOG } from '../content/catalog.js';
import { pack, presetOf } from '../domain/items.js';
import { weaponModel, lootModel } from '../rendering/models.js';
import { model, transform } from '../rendering/math.js';
export const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const button = (text: string, action: string, id = '', cls = '', disabled = false) => `<button class="${cls}" data-act="${esc(action)}" data-id="${esc(id)}" ${disabled ? 'disabled' : ''}>${text}</button>`;
const icons = new Map<string, string>();
const iconGeometry = new Map<string, Float32Array>();
export function icon(item: Item): string {
    const key = item.def + (CATALOG[item.def].category === 'weapon' ? JSON.stringify(presetOf(item)) : '');
    if (icons.has(key))
        return icons.get(key)!;
    const parts = CATALOG[item.def].category === 'weapon' ? weaponModel(item) : lootModel(item), polys: {
        points: [
            number,
            number
        ][];
        depth: number;
        color: string;
    }[] = [];
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
    for (const part of parts) {
        if (part.assetOnly) continue;
        const m = model(part.p, part.s, part.r);
        let vertices = iconGeometry.get(part.shape);
        if (!vertices) { vertices = geometry(part.shape).vertices; iconGeometry.set(part.shape, vertices); }
        for (let at = 0; at < vertices.length; at += 18) {
            const points = [0,6,12].map(offset => transform(m, [vertices[at+offset], vertices[at+offset+1], vertices[at+offset+2]]));
            const projected = points.map(([x,y,z]): [number,number] => [.7071*(x+z), .2357*x-.9428*y-.2357*z]);
            for (const [x,y] of projected) { xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y); }
            const [a,b,c]=points, u=b.map((n,i)=>n-a[i]), v=c.map((n,i)=>n-a[i]);
            const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], length=Math.hypot(...n);
            if (length<1e-12 || n[0]*.6667+n[1]*.3333-n[2]*.6667<=0) continue;
            const shade=.63+.46*Math.max(0,(-.46*n[0]+.83*n[1]+.32*n[2])/length);
            const colour=part.c.map(v=>Math.min(255,Math.round(v*255*shade+14)));
            const center=a.map((v,i)=>(v+b[i]+c[i])/3);
            polys.push({points:projected,depth:.6667*center[0]+.3333*center[1]-.6667*center[2],color:`rgb(${colour.join(',')})`});
        }
    }
    const scale = Math.min(88 / (xmax - xmin || 1), 53 / (ymax - ymin || 1));
    polys.sort((a, b) => a.depth - b.depth);
    const paths = polys.map(p => `<polygon points="${p.points.map(([x, y]) => `${((x - (xmin + xmax) / 2) * scale + 48).toFixed(1)},${((y - (ymin + ymax) / 2) * scale + 32).toFixed(1)}`).join(' ')}" fill="${p.color}"/>`).join('');
    const svg = `<svg aria-hidden="true" viewBox="0 0 96 64">${paths}</svg>`;
    if (icons.size >= 512) icons.delete(icons.keys().next().value!);
    icons.set(key, svg);
    return svg;
}
export function inventoryGrid(items: Item[], target: string, cols: number, rows: number, selected = '', cell = '32px'): string {
    const placement = pack(items, cols, rows);
    if (!placement)
        return '<p class="bad">Нет места для размещения вещей.</p>';
    return `<div class="grid drop" data-target="${target}" style="--cols:${cols};--rows:${rows};--cell:${cell}">${placement.map(p => { const item = items.find(i => i.id === p.id)!, d = CATALOG[item.def]; return `<button draggable="true" data-item="${esc(item.id)}" data-act="select-item" data-id="${esc(item.id)}" data-search="${esc(d.name.toLowerCase())}" title="${esc(d.name)}${item.qty > 1 ? ' × ' + item.qty : ''}" aria-label="${esc(d.name)}" class="item rarity${d.rarity} ${selected === item.id ? 'selected' : ''}" style="grid-column:${p.x + 1}/span ${p.w};grid-row:${p.y + 1}/span ${p.h}">${icon(item)}<span class="abbr">${esc(d.name)}</span>${isMagazine(item) ? `<span class="qty">${item.rounds}</span>` : item.qty > 1 ? `<span class="qty">${item.qty}</span>` : ''}</button>`; }).join('')}</div>`;
}
const mapBackground = new WeakMap<MapDef, string>();
export function mapSvg(map: MapDef, player?: {
    p: Vec3;
    yaw: number;
}, labels = true, activated: string[] = [], targetExit = ''): string {
    const [w, h] = map.size;
    const marker=Math.max(1,w/172);
    let shapes = mapBackground.get(map) || '';
    if(!shapes) {
    for (const b of map.boxes) {
        if (['roof', 'gable', 'machine', 'conveyor', 'window', 'lamphead', 'step', 'collision-only'].includes(b.kind))
            continue;
        if (b.kind === 'tree') {
            shapes += `<circle cx="${b.p[0]}" cy="${b.p[2]}" r="2.1" fill="#43583b"/>`;
            continue;
        }
        if (!b.solid && !['road', 'path', 'dirt', 'water', 'tile', 'walk'].includes(b.kind))
            continue;
        shapes += `<rect x="${b.p[0] - b.s[0] / 2}" y="${b.p[2] - b.s[2] / 2}" width="${b.s[0]}" height="${b.s[2]}" fill="${b.kind === 'wall' ? '#a2a78c' : b.kind === 'water' ? '#51777b' : b.kind === 'road' || b.kind === 'path' ? '#61715b' : '#6a765e'}" opacity="${b.p[1] > 3 ? .5 : .95}"/>`;
    }
    mapBackground.set(map,shapes);
    }
    for (const e of map.exits) {
        const locked = e.requires && !activated.includes(e.requires);
        if (e.id === targetExit)
            shapes += `<circle cx="${e.p[0]}" cy="${e.p[2]}" r="${(e.radius + 3)*marker}" fill="none" stroke="#f5e4a2" stroke-width="${marker}" stroke-dasharray="${marker*2} ${marker}"/>`;
        shapes += `<g><title>${esc(e.name)}${locked ? ' — закрыт' : ' — доступен'}</title><circle cx="${e.p[0]}" cy="${e.p[2]}" r="${(e.radius + 1)*marker}" fill="${locked ? '#c3a267' : '#a6c17f'}" stroke="#d4e3b8" stroke-width=".6"/><text x="${e.p[0]}" y="${e.p[2] + 1.3*marker}" text-anchor="middle" font-size="${4*marker}" fill="#1c3625">${locked ? '!' : '↗'}</text></g>`;
    }
    for (const a of map.activators || []) shapes += `<g><title>${esc(a.name)}</title><rect x="${a.p[0]-1.7}" y="${a.p[2]-1.7}" width="3.4" height="3.4" fill="${activated.includes(a.id) ? '#a6c17f' : '#c3a267'}" stroke="#fff" stroke-width=".4"/></g>`;
    if (labels)
        for (const p of map.pois)
            shapes += `<text x="${p.p[0]}" y="${p.p[2] - 4}" text-anchor="middle" font-family="sans-serif" font-size="${p.id.startsWith('district-')?2.3*marker:3.8}" fill="#eff3d8" stroke="#182b1c" stroke-width=".7" paint-order="stroke">${esc(p.name)}</text>`;
    if (player)
        shapes += `<g transform="translate(${player.p[0]},${player.p[2]}) rotate(${-player.yaw * 180 / Math.PI}) scale(${marker})"><path d="M0 -4 L2.4 3 L0 1.7 L-2.4 3 Z" fill="#f4e6b5" stroke="#15271a" stroke-width=".5"/></g>`;
    return `<svg viewBox="${-w / 2 - 3} ${-h / 2 - 3} ${w + 6} ${h + 6}" role="img" aria-label="Схема карты ${esc(map.name)}"><rect x="${-w / 2 - 3}" y="${-h / 2 - 3}" width="${w + 6}" height="${h + 6}" fill="#1a2c20"/>${shapes}</svg>`;
}
export const timeText = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
