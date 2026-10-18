import sharp from 'sharp';
import { PATCH_INPUT_BYTES, PATCH_OUTPUT_BYTES, PATCH_PIXELS } from '../dist/src/domain/patches.js';
import { inspectPatchImage, PatchImageInputError } from '../dist/src/domain/patch-image-header.js';

export class PatchError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

/** A distinct binary reader keeps profile commands limited to their existing 16 KiB. */
export async function readPatchBody(req) {
    const size = req.headers['content-length'];
    if (size && (!/^\d+$/.test(size) || Number(size) > PATCH_INPUT_BYTES)) throw new PatchError(413, 'Изображение должно быть не больше 2 МиБ');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > PATCH_INPUT_BYTES) throw new PatchError(413, 'Изображение должно быть не больше 2 МиБ');
        chunks.push(chunk);
    }
    if (!bytes) throw new PatchError(400, 'Выберите изображение');
    return Buffer.concat(chunks);
}

export async function normalizePatch(input) {
    if (!input.length || input.length > PATCH_INPUT_BYTES) throw new PatchError(413, 'Изображение должно быть не больше 2 МиБ');
    try {
        inspectPatchImage(input);
        const image = sharp(input, { limitInputPixels: PATCH_PIXELS, failOn: 'warning' }).timeout({ seconds: 10 });
        const metadata = await image.metadata();
        if (!['png', 'jpeg', 'webp'].includes(metadata.format)) throw new PatchError(415, 'Выберите PNG, JPEG или WebP');
        if ((metadata.pages || 1) !== 1 || metadata.delay?.length || (metadata.pageHeight && metadata.pageHeight !== metadata.height)) throw new PatchError(415, 'Патч должен быть неподвижным изображением');
        const png = await image.autoOrient().toColourspace('srgb').resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().png({ compressionLevel: 9 }).toBuffer();
        if (png.length > PATCH_OUTPUT_BYTES) throw new PatchError(413, 'Не удалось уменьшить патч до допустимого размера');
        return png;
    } catch (error) {
        if (error instanceof PatchError) throw error;
        if (error instanceof PatchImageInputError) throw new PatchError(error.status, error.message);
        throw new PatchError(400, 'Изображение повреждено или превышает 16 мегапикселей');
    }
}
