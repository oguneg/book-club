// ISBN parsing. Everything is stored and compared as ISBN-13; ISBN-10s are converted.

function digitsOnly(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((acc, ch, i) => acc + (ch === 'X' ? 10 : Number(ch)) * (10 - i), 0);
  return sum % 11 === 0;
}

export function isbn10To13(isbn10: string): string {
  const core = `978${isbn10.slice(0, 9)}`;
  const sum = [...core].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

/** A valid ISBN-10 or ISBN-13 (spaces and hyphens allowed) as ISBN-13, otherwise null. */
export function normalizeIsbn(input: string): string | null {
  const isbn = digitsOnly(input);
  if (isValidIsbn13(isbn)) return isbn;
  if (isValidIsbn10(isbn)) return isbn10To13(isbn);
  return null;
}

/** Whether a search box entry is meant as an ISBN (so the app looks it up instead of searching titles). */
export function looksLikeIsbn(input: string): boolean {
  return /^[\d\s-]{9,17}[\dXx]$/.test(input.trim()) && digitsOnly(input).length >= 10;
}
