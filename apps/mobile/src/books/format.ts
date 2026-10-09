import type { Edition } from '@bookclub/shared';

// ISO 639-2 codes (as Open Library uses them) for the languages most likely in a club. Others show the code.
const LANGUAGE_NAMES: Record<string, string> = {
  eng: 'English', swe: 'Swedish', nor: 'Norwegian', dan: 'Danish', fin: 'Finnish', ice: 'Icelandic', ger: 'German',
  fre: 'French', spa: 'Spanish', ita: 'Italian', por: 'Portuguese', dut: 'Dutch', pol: 'Polish', cze: 'Czech',
  hun: 'Hungarian', gre: 'Greek', tur: 'Turkish', rus: 'Russian', ukr: 'Ukrainian', slv: 'Slovenian', hrv: 'Croatian',
  srp: 'Serbian', rum: 'Romanian', bul: 'Bulgarian', ara: 'Arabic', heb: 'Hebrew', per: 'Persian', hin: 'Hindi',
  chi: 'Chinese', jpn: 'Japanese', kor: 'Korean', lat: 'Latin', est: 'Estonian', lav: 'Latvian', lit: 'Lithuanian',
};

export function languageName(code: string | null): string | null {
  if (!code) return null;
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

export function formatAuthors(authors: string[]): string {
  if (authors.length <= 2) return authors.join(' & ');
  return `${authors.slice(0, 2).join(', ')} +${authors.length - 2}`;
}

/** The year in a free-form publication date ("May 2003" → "2003"). */
export function publishedYear(published: string | null): string | null {
  return /\d{4}/.exec(published ?? '')?.[0] ?? null;
}

/** Words an edition can be found by in the edition list's filter box. */
export function editionSearchText(e: Edition): string {
  return [e.title, e.subtitle, e.publisher, e.published, languageName(e.language), e.isbn13].filter(Boolean).join(' ').toLowerCase();
}

// Device language (ISO 639-1, from the OS) to Open Library's ISO 639-2 codes.
const FROM_639_1: Record<string, string> = {
  en: 'eng', sv: 'swe', nb: 'nor', nn: 'nor', no: 'nor', da: 'dan', fi: 'fin', is: 'ice', de: 'ger', fr: 'fre',
  es: 'spa', it: 'ita', pt: 'por', nl: 'dut', pl: 'pol', cs: 'cze', hu: 'hun', el: 'gre', tr: 'tur', ru: 'rus',
  uk: 'ukr', ar: 'ara', he: 'heb', fa: 'per', hi: 'hin', zh: 'chi', ja: 'jpn', ko: 'kor',
};

/** Languages to list first: the device's languages, then English. */
export function preferredLanguages(deviceLanguages: (string | null | undefined)[]): string[] {
  const codes = deviceLanguages.map((l) => (l ? FROM_639_1[l.toLowerCase()] : undefined)).filter((c): c is string => Boolean(c));
  return [...new Set([...codes, 'eng'])];
}

/** Editions in preferred languages first; otherwise keeps the server's order (page count, ISBN, newest). */
export function sortByLanguage<T extends { language: string | null }>(editions: T[], preferred: string[]): T[] {
  const rank = (e: T) => {
    const i = e.language ? preferred.indexOf(e.language) : -1;
    return i === -1 ? preferred.length : i;
  };
  return [...editions].sort((a, b) => rank(a) - rank(b));
}

/**
 * From editions already in preference order, a typical copy to read: among those with a page count in the
 * first such edition's language, the one closest to the book's median length, so an abridged edition or an
 * omnibus isn't the default. The median counts every language: translations run about as long, and a
 * reader's own language often has only a couple of editions with a page count. Ties keep the given order.
 */
export function typicalEdition<T extends { language: string | null; pageCount: number | null }>(sorted: T[]): T | undefined {
  const counted = sorted.filter((e) => e.pageCount);
  if (counted.length === 0) return sorted[0];
  const same = counted.filter((e) => e.language === counted[0]!.language);
  const pages = counted.map((e) => e.pageCount!).sort((a, b) => a - b);
  const median = pages[Math.floor((pages.length - 1) / 2)]!;
  return same.reduce((best, e) => (Math.abs(e.pageCount! - median) < Math.abs(best.pageCount! - median) ? e : best));
}
