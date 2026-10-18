import { inspectPatchImage } from '../domain/patch-image-header.js';
import { PATCH_INPUT_BYTES, PATCH_OUTPUT_BYTES, PATCH_PIXELS } from '../domain/patches.js';

export async function patchHash(blob: Blob): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}

/** Canvas re-encoding removes metadata; only raster signatures reach the decoder. */
export async function normalizePatchImage(file: Blob, requireMetadataFree = false): Promise<Blob> {
    if (!file.size || file.size > PATCH_INPUT_BYTES) throw Error('Выберите изображение не больше 2 МиБ');
    inspectPatchImage(new Uint8Array(await file.arrayBuffer()), requireMetadataFree);
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { throw Error('Не удалось прочитать изображение'); }
    try {
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > PATCH_PIXELS) throw Error('Изображение превышает 16 мегапикселей');
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const context = canvas.getContext('2d');
        if (!context) throw Error('Не удалось подготовить патч');
        const scale = Math.min(256 / bitmap.width, 256 / bitmap.height), drawnWidth = bitmap.width * scale, drawnHeight = bitmap.height * scale;
        context.drawImage(bitmap, (256 - drawnWidth) / 2, (256 - drawnHeight) / 2, drawnWidth, drawnHeight);
        const output = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('Не удалось подготовить патч')), 'image/png'));
        if (output.size > PATCH_OUTPUT_BYTES) throw Error('Не удалось уменьшить патч');
        return output;
    } finally { bitmap.close(); }
}

export async function blobBase64(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let text = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    return btoa(text);
}

export function base64Blob(text: string): Blob {
    if (text.length > PATCH_OUTPUT_BYTES * 4 / 3 + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw Error('Повреждено изображение патча');
    const raw = atob(text);
    return new Blob([Uint8Array.from(raw, c => c.charCodeAt(0))], { type: 'image/png' });
}
