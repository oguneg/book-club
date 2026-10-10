import { normalizeIsbn } from '@bookclub/shared';

/**
 * The ISBN in a scanned barcode. A book's barcode is an EAN-13 starting 978 or 979 (its ISBN-13); anything
 * else (a shop's price label, a magazine's code) isn't a book, and a misread fails the check digit.
 */
export function isbnFromBarcode(data: string): string | null {
  const digits = data.replace(/\D/g, '');
  if (!/^97[89]\d{10}$/.test(digits)) return null;
  return normalizeIsbn(digits);
}
