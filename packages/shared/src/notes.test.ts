import { describe, expect, it } from 'vitest';
import { createNoteInput, isSpoilerFor, notePlace } from './notes';

const viewer = { position: 4000, editionId: 'hardcover', startPage: 1, endPage: 400 };

describe('notes', () => {
  it('blurs only what lies past the reader', () => {
    expect(isSpoilerFor(4001, viewer)).toBe(true);
    expect(isSpoilerFor(4000, viewer)).toBe(false);
    expect(isSpoilerFor(1, null)).toBe(true);
    expect(isSpoilerFor(0, null)).toBe(false);
  });

  it("shows the reader's own page: exact for their edition, ≈ for others, % without a reading", () => {
    expect(notePlace({ position: 4000, page: 160, editionId: 'hardcover' }, viewer)).toEqual({ page: 160, approximate: false, percent: 40 });
    expect(notePlace({ position: 4000, page: 120, editionId: 'paperback' }, viewer)).toEqual({ page: 160, approximate: true, percent: 40 });
    expect(notePlace({ position: 4000, page: 120, editionId: 'paperback' }, null)).toEqual({ page: null, approximate: false, percent: 40 });
  });

  it('needs exactly one of page or percent, and a club for club notes', () => {
    const base = { readingId: '00000000-0000-4000-8000-000000000000', body: 'Bilbo!', visibility: 'public' as const };
    expect(createNoteInput.safeParse({ ...base, page: 12 }).success).toBe(true);
    expect(createNoteInput.safeParse({ ...base }).success).toBe(false);
    expect(createNoteInput.safeParse({ ...base, page: 12, percent: 3 }).success).toBe(false);
    expect(createNoteInput.safeParse({ ...base, page: 12, visibility: 'club' }).success).toBe(false);
  });
});
