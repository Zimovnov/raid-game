import type { CharacterLayer } from '../domain/types.js';
import { CHARACTER_OVERRIDES } from './overhaul-character-assets.js';

/** Exact appearance IDs opt in only after their complete authored layer passes art QA. */
export const CHARACTER_MODEL_ASSETS: Record<string, { asset: string; layer: CharacterLayer }> = { ...CHARACTER_OVERRIDES };
