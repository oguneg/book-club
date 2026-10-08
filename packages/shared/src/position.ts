// Where a reader is in a book, independent of edition. See docs/ARCHITECTURE.md, "Position model".
//
// A position is an integer from 0 to POSITION_SCALE: the share of the book's story pages read.
// Logging "page 120" means pages up to and including 120 are read, so in a 1..300 edition that is
// 120/300 = 40% = 4000, and the matching page in a 1..400 edition is 160.

export const POSITION_SCALE = 10_000;

/** The pages of an edition that count as the book: front and back matter can be left out. */
export interface PageRange {
  startPage: number;
  endPage: number;
}

export function isValidPageRange({ startPage, endPage }: PageRange): boolean {
  return Number.isInteger(startPage) && Number.isInteger(endPage) && startPage >= 1 && endPage > startPage;
}

function pageCount({ startPage, endPage }: PageRange): number {
  return endPage - startPage + 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function assertRange(range: PageRange): void {
  if (!isValidPageRange(range)) {
    throw new RangeError(`Invalid page range ${range.startPage}..${range.endPage}`);
  }
}

/** Position after reading up to and including `page`. Pages outside the range clamp to 0 or the end. */
export function pageToPosition(page: number, range: PageRange): number {
  assertRange(range);
  const read = clamp(page - range.startPage + 1, 0, pageCount(range));
  return Math.round((read / pageCount(range)) * POSITION_SCALE);
}

/** The page in this edition that matches a position (rounded, kept inside the range). */
export function positionToPage(position: number, range: PageRange): number {
  assertRange(range);
  const read = Math.round((clamp(position, 0, POSITION_SCALE) / POSITION_SCALE) * pageCount(range));
  return clamp(range.startPage - 1 + read, range.startPage, range.endPage);
}

/** For e-readers that show a percentage (0–100). */
export function percentToPosition(percent: number): number {
  return Math.round(clamp(percent, 0, 100) * (POSITION_SCALE / 100));
}

export function positionToPercent(position: number): number {
  return (clamp(position, 0, POSITION_SCALE) / POSITION_SCALE) * 100;
}

/** Spoiler rule: content placed beyond the viewer's own position is shown blurred. */
export function isAhead(contentPosition: number, viewerPosition: number): boolean {
  return contentPosition > viewerPosition;
}
