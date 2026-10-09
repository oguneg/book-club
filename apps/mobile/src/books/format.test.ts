import { describe, expect, it } from 'vitest';
import { formatAuthors, preferredLanguages, publishedYear, sortByLanguage } from './format';

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
});
