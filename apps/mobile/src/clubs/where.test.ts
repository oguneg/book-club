import i18next from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import { whereEveryoneIs, type LineMember } from './where';

const i18n = i18next.createInstance();
beforeAll(() => i18n.init({ lng: 'en', resources: { en: { translation: en } } }));

const member = (name: string, position: number | null): LineMember => ({ userId: name, name, position, me: false });

describe('where everyone is', () => {
  it('says it in your own pages, furthest first', () => {
    // You're at 59% of a 319-page story.
    const line = whereEveryoneIs(i18n.t, [member('Lena Berg', 1900), member('Sam Okafor', 6700), member('Mo Moderator', null)], 5900, 319);
    expect(line).toBe('Sam ≈26 pages ahead · Lena ≈128 behind · Mo hasn’t started');
  });

  it('calls a page or so "with you", and counts one page as one', () => {
    expect(whereEveryoneIs(i18n.t, [member('Ann', 5920)], 5900, 319)).toBe('Ann is with you');
    expect(whereEveryoneIs(i18n.t, [member('Ann', 5960)], 5900, 319)).toBe('Ann ≈2 pages ahead');
  });

  it('uses percentages before you have started, and folds a long list', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => member(n, 1000 * (i + 1)));
    expect(whereEveryoneIs(i18n.t, many.slice(0, 1), null, 300)).toBe('A 10%');
    expect(whereEveryoneIs(i18n.t, many, null, 300)).toBe('F 60% · E 50% · D 40% · C 30% · +2 more');
  });
});
