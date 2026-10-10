import { describe, expect, it } from 'vitest';
import { isbnFromBarcode } from './barcode';

describe('reading a book from its barcode', () => {
  it('takes the ISBN from a book barcode', () => {
    expect(isbnFromBarcode('9780261103344')).toBe('9780261103344');
    expect(isbnFromBarcode('979-10-90636-07-1')).toBe('9791090636071');
  });

  it("ignores codes that aren't books, and misreads", () => {
    // A grocery EAN, a UPC, a wrong check digit, a partial read.
    expect(isbnFromBarcode('4006381333931')).toBeNull();
    expect(isbnFromBarcode('036000291452')).toBeNull();
    expect(isbnFromBarcode('9780261103345')).toBeNull();
    expect(isbnFromBarcode('978026110')).toBeNull();
  });
});
