import { describe, expect, it } from 'vitest';
import { formatAuthors, preferredLanguages, publishedYear, sortByLanguage, typicalEdition } from './format';

describe('book formatting', () => {
  it('shortens long author lists', () => {
    expect(formatAuthors(['A'])).toBe('A');
    expect(formatAuthors(['A', 'B'])).toBe('A & B');
    expect(formatAuthors(['A', 'B', 'C', 'D'])).toBe('A, B +2');
  });

  it('finds the year in free-form dates', () => {
    expect(publishedYear('May 2003')).toBe('2003');
    expect(publishedYear('2003-05-01')).toBe('2003');
    expect(publishedYear(null)).toBeNull();
  });

  it('puts editions in the reader’s languages first, keeping the order otherwise', () => {
    const preferred = preferredLanguages(['sv', 'en']);
    expect(preferred).toEqual(['swe', 'eng']);
    const sorted = sortByLanguage(
      [
        { id: 1, language: 'por' },
        { id: 2, language: 'eng' },
        { id: 3, language: null },
        { id: 4, language: 'swe' },
        { id: 5, language: 'eng' },
      ],
      preferred,
    );
    expect(sorted.map((e) => e.id)).toEqual([4, 2, 5, 1, 3]);
  });

  it('starts you on a typical edition, not an abridged one or an omnibus', () => {
    const pick = (editions: { id: number; language: string | null; pageCount: number | null; title?: string }[]) =>
      typicalEdition(editions.map((e) => ({ title: 'Little Women', ...e })))?.id;
    expect(
      pick([
        { id: 1, language: 'eng', pageCount: 114 },
        { id: 2, language: 'eng', pageCount: 280 },
        { id: 3, language: 'eng', pageCount: null },
        { id: 4, language: 'eng', pageCount: 1024 },
        { id: 5, language: 'eng', pageCount: 266 },
        { id: 6, language: 'fre', pageCount: 270 },
      ]),
    ).toBe(5);
    // Two English editions with a page count (an abridged 114 and a full 201): translations settle it.
    expect(
      pick([
        { id: 1, language: 'eng', pageCount: 114 },
        { id: 2, language: 'eng', pageCount: 201 },
        { id: 3, language: 'fre', pageCount: 320 },
        { id: 4, language: 'ger', pageCount: 272 },
        { id: 5, language: 'por', pageCount: 336 },
      ]),
    ).toBe(2);
    // An abridged edition is the default only when nothing else has a page count.
    expect(
      pick([
        { id: 1, language: 'eng', pageCount: 290, title: 'Little Women, modern abridged edition' },
        { id: 2, language: 'eng', pageCount: 520 },
        { id: 3, language: 'eng', pageCount: 280, title: 'Little Women (Retold)' },
      ]),
    ).toBe(2);
    expect(pick([{ id: 1, language: 'eng', pageCount: 290, title: 'Little Women, abridged' }])).toBe(1);
    // Ties keep the server's order; other languages only when yours has no page counts.
    expect(pick([{ id: 1, language: 'eng', pageCount: 300 }, { id: 2, language: 'eng', pageCount: 300 }])).toBe(1);
    expect(pick([{ id: 1, language: 'eng', pageCount: null }, { id: 2, language: 'fre', pageCount: 270 }])).toBe(2);
    expect(pick([{ id: 1, language: 'eng', pageCount: null }])).toBe(1);
    expect(pick([])).toBeUndefined();
  });
});
