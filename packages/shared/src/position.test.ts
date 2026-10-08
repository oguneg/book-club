import { describe, expect, it } from 'vitest';
import {
  POSITION_SCALE,
  isAhead,
  isValidPageRange,
  pageToPosition,
  percentToPosition,
  positionToPage,
  positionToPercent,
} from './position';

const paperback = { startPage: 1, endPage: 300 };
const hardcover = { startPage: 1, endPage: 400 };

describe('pageToPosition', () => {
  it('counts the logged page as read', () => {
    expect(pageToPosition(120, paperback)).toBe(4000);
    expect(pageToPosition(300, paperback)).toBe(POSITION_SCALE);
    expect(pageToPosition(1, paperback)).toBe(33);
  });

  it('skips front matter when the story starts later', () => {
    const range = { startPage: 11, endPage: 310 };
    expect(pageToPosition(130, range)).toBe(4000);
    expect(pageToPosition(10, range)).toBe(0);
    expect(pageToPosition(5, range)).toBe(0);
  });

  it('clamps pages past the end', () => {
    expect(pageToPosition(350, paperback)).toBe(POSITION_SCALE);
  });

  it('rejects invalid ranges', () => {
    expect(() => pageToPosition(1, { startPage: 10, endPage: 10 })).toThrow(RangeError);
    expect(() => pageToPosition(1, { startPage: 0, endPage: 10 })).toThrow(RangeError);
    expect(() => pageToPosition(1, { startPage: 1.5, endPage: 10 })).toThrow(RangeError);
  });
});

describe('positionToPage', () => {
  it('maps a note between editions', () => {
    expect(positionToPage(pageToPosition(120, paperback), hardcover)).toBe(160);
    expect(positionToPage(pageToPosition(160, hardcover), paperback)).toBe(120);
  });

  it('round-trips every page within the same edition', () => {
    for (let page = paperback.startPage; page <= paperback.endPage; page++) {
      expect(positionToPage(pageToPosition(page, paperback), paperback)).toBe(page);
    }
  });

  it('stays inside the range', () => {
    expect(positionToPage(0, paperback)).toBe(1);
    expect(positionToPage(POSITION_SCALE * 2, paperback)).toBe(300);
    expect(positionToPage(0, { startPage: 11, endPage: 310 })).toBe(11);
  });
});

describe('percent', () => {
  it('converts both ways and clamps', () => {
    expect(percentToPosition(42.5)).toBe(4250);
    expect(percentToPosition(120)).toBe(POSITION_SCALE);
    expect(percentToPosition(-3)).toBe(0);
    expect(positionToPercent(4250)).toBe(42.5);
  });
});

describe('isValidPageRange', () => {
  it('needs whole pages, starting at 1 or later, ending after the start', () => {
    expect(isValidPageRange(paperback)).toBe(true);
    expect(isValidPageRange({ startPage: 300, endPage: 1 })).toBe(false);
  });
});

describe('isAhead', () => {
  it('blurs only content beyond the viewer', () => {
    expect(isAhead(4001, 4000)).toBe(true);
    expect(isAhead(4000, 4000)).toBe(false);
    expect(isAhead(3999, 4000)).toBe(false);
  });
});
