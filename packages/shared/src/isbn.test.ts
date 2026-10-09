import { describe, expect, it } from 'vitest';
import { isValidIsbn10, isValidIsbn13, isbn10To13, looksLikeIsbn, normalizeIsbn } from './isbn';

describe('ISBN', () => {
  it('validates check digits', () => {
    expect(isValidIsbn13('9780141439518')).toBe(true);
    expect(isValidIsbn13('9780141439519')).toBe(false);
    expect(isValidIsbn10('0141439513')).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
    expect(isValidIsbn10('0141439514')).toBe(false);
  });

  it('converts ISBN-10 to ISBN-13', () => {
    expect(isbn10To13('0141439513')).toBe('9780141439518');
    expect(isbn10To13('080442957X')).toBe('9780804429573');
  });

  it('normalizes what people type or scan', () => {
    expect(normalizeIsbn('978-0-14-143951-8')).toBe('9780141439518');
    expect(normalizeIsbn(' 0 14 143951 3 ')).toBe('9780141439518');
    expect(normalizeIsbn('080442957x')).toBe('9780804429573');
    expect(normalizeIsbn('9780141439519')).toBeNull();
    expect(normalizeIsbn('the hobbit')).toBeNull();
  });

  it('tells ISBNs from titles in the search box', () => {
    expect(looksLikeIsbn('978-0-14-143951-8')).toBe(true);
    expect(looksLikeIsbn('0141439513')).toBe(true);
    expect(looksLikeIsbn('1984')).toBe(false);
    expect(looksLikeIsbn('Catch-22')).toBe(false);
  });
});
