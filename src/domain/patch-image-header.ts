import { PATCH_INPUT_BYTES, PATCH_PIXELS } from './patches.js';

export class PatchImageInputError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
}

/** Shared bounded raster header/animation checks before either image decoder. */
export function inspectPatchImage(bytes: Uint8Array, requireMetadataFree = false): { format: 'png' | 'jpeg' | 'webp'; width: number; height: number } {
    if (!bytes.length || bytes.length > PATCH_INPUT_BYTES) throw new PatchImageInputError('Выберите изображение не больше 2 МиБ', 413);
    const head = bytes.subarray(0, 32);
    const png = head[0] === 137 && head[1] === 80 && head[2] === 78 && head[3] === 71;
    const jpeg = head[0] === 255 && head[1] === 216 && head[2] === 255;
    const webp = new TextDecoder().decode(head.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(head.slice(8, 12)) === 'WEBP';
    if (!png && !jpeg && !webp) throw new PatchImageInputError('Выберите PNG, JPEG или WebP', 415);
    // Animation chunks are rejected even when the browser would decode only frame 1.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let width = 0, height = 0;
    if (png) {
        if (bytes.length < 24) throw new PatchImageInputError('Изображение повреждено');
        width = view.getUint32(16); height = view.getUint32(20);
        for (let offset = 8; offset + 12 <= bytes.length;) {
            const size = view.getUint32(offset), name = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
            if (name === 'acTL') throw new PatchImageInputError('Патч должен быть неподвижным изображением', 415);
            if (requireMetadataFree && ['eXIf', 'tEXt', 'zTXt', 'iTXt', 'iCCP'].includes(name)) throw new PatchImageInputError('Изображение патча в профиле содержит метаданные');
            offset += size + 12;
        }
    }
    if (jpeg) {
        for (let offset = 2; offset + 8 < bytes.length;) {
            if (bytes[offset++] !== 255) throw new PatchImageInputError('Изображение повреждено');
            while (bytes[offset] === 255) offset++;
            if (offset + 3 > bytes.length) throw new PatchImageInputError('Изображение повреждено');
            const marker = bytes[offset++];
            if (marker === 0xda || marker === 0xd9) break;
            if (marker >= 0xd0 && marker <= 0xd7) continue;
            const length = view.getUint16(offset);
            if (length < 2 || offset + length > bytes.length) throw new PatchImageInputError('Изображение повреждено');
            if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
                if (length < 8) throw new PatchImageInputError('Изображение повреждено');
                height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
            }
            offset += length;
        }
    }
    if (webp) {
        const chunk = new TextDecoder().decode(head.slice(12, 16));
        if (chunk === 'VP8X' && bytes.length >= 30) {
            if (head[20] & 2) throw new PatchImageInputError('Патч должен быть неподвижным изображением', 415);
            width = 1 + head[24] + head[25] * 256 + head[26] * 65536;
            height = 1 + head[27] + head[28] * 256 + head[29] * 65536;
        } else if (chunk === 'VP8 ' && bytes.length >= 30) {
            width = view.getUint16(26, true) & 0x3fff; height = view.getUint16(28, true) & 0x3fff;
        } else if (chunk === 'VP8L' && bytes.length >= 25) {
            const bits = view.getUint32(21, true); width = 1 + (bits & 0x3fff); height = 1 + ((bits >>> 14) & 0x3fff);
        }
    }
    if (!width || !height) throw new PatchImageInputError('Изображение повреждено');
    if (width * height > PATCH_PIXELS) throw new PatchImageInputError('Изображение превышает 16 мегапикселей', 413);
    return { format: png ? 'png' : jpeg ? 'jpeg' : 'webp', width, height };
}
