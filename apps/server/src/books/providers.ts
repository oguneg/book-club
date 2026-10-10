// Book metadata providers. Plain HTTP clients with an injectable fetch, so tests replay recorded answers.
// Caching and storage live in service.ts.
import { normalizeIsbn, type WorkSummary } from '@bookclub/shared';

export type Fetch = typeof fetch;

/** An edition as a provider describes it, before it gets one of our ids. */
export interface ProviderEdition {
  source: 'openlibrary' | 'google';
  sourceId: string;
  isbn13: string | null;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  published: string | null;
  pageCount: number | null;
  language: string | null;
  workKey: string | null;
  cover: string | null;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// Open Library asks clients to identify themselves.
const USER_AGENT = 'Bookclub/1.0 (+https://bookclub.ogun.se)';
const TIMEOUT_MS = 8000;

/** GET JSON; null on 404, ProviderError on anything else that isn't a success. */
async function getJson<T>(fetchFn: Fetch, provider: string, url: string): Promise<T | null> {
  let res: Response;
  try {
    res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ProviderError(provider, null, `${provider} unreachable: ${(err as Error).message}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ProviderError(provider, res.status, `${provider} answered ${res.status}`);
  return (await res.json()) as T;
}

const workId = (key: string | undefined) => key?.replace(/^\/works\//, '') ?? null;
const editionId = (key: string) => key.replace(/^\/books\//, '');
const languageCode = (key: string | undefined) => key?.replace(/^\/languages\//, '') ?? null;
const positiveInt = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null);
const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

// Google Books gives ISO 639-1 codes; Open Library (and we) use ISO 639-2/B.
const LANGUAGE_639_2: Record<string, string> = {
  en: 'eng', sv: 'swe', de: 'ger', fr: 'fre', es: 'spa', it: 'ita', nl: 'dut', no: 'nor', nb: 'nor', da: 'dan', fi: 'fin',
  pt: 'por', ru: 'rus', pl: 'pol', tr: 'tur', ja: 'jpn', zh: 'chi', ko: 'kor', ar: 'ara', el: 'gre', cs: 'cze', hu: 'hun', uk: 'ukr',
};

// ---- Open Library ----------------------------------------------------------------------------------

interface OlSearchDoc {
  key: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  edition_count?: number;
  /** Normalised subjects, e.g. "fiction", "fiction,_romance,_contemporary", "nonfiction". */
  subject_key?: string[];
}

/** Subjects that make a "fiction"-tagged work something else for our purposes: self-help, children's books. */
const NOT_A_NOVEL = new Set(['nonfiction', 'non-fiction', 'self-help', 'psychology', 'success', 'business', 'personal_development', 'juvenile_fiction', 'juvenile_literature', "children's_fiction"]);

/**
 * A novel for grown-ups, by Open Library's subjects; with a title in the Latin alphabet, since the app is in
 * English (a work's title is often its original one).
 */
function isAdultFiction(doc: OlSearchDoc): boolean {
  const keys = doc.subject_key ?? [];
  const fiction = keys.some((k) => k === 'fiction' || k.startsWith('fiction,') || k.startsWith('fiction_'));
  return fiction && !keys.some((k) => NOT_A_NOVEL.has(k)) && /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u.test(doc.title ?? '');
}

interface OlEdition {
  key: string;
  title?: string;
  subtitle?: string;
  number_of_pages?: number;
  publishers?: string[];
  publish_date?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  covers?: number[];
  languages?: { key: string }[];
  works?: { key: string }[];
}

const SEARCH_FIELDS = 'key,title,author_name,cover_i,first_publish_year,edition_count';

function toWorkSummary(doc: OlSearchDoc): WorkSummary | null {
  const key = workId(doc.key);
  const title = clean(doc.title);
  if (!key || !title) return null;
  return {
    key,
    title,
    authors: doc.author_name?.slice(0, 5) ?? [],
    firstPublished: positiveInt(doc.first_publish_year),
    editionCount: positiveInt(doc.edition_count) ?? 0,
    cover: positiveInt(doc.cover_i) ? `ol-${doc.cover_i}-M` : null,
  };
}

function fromOlEdition(raw: OlEdition, authors: string[]): ProviderEdition | null {
  const title = clean(raw.title);
  if (!title) return null;
  const isbn = [...(raw.isbn_13 ?? []), ...(raw.isbn_10 ?? [])].map(normalizeIsbn).find(Boolean) ?? null;
  const coverId = raw.covers?.find((id) => positiveInt(id));
  return {
    source: 'openlibrary',
    sourceId: editionId(raw.key),
    isbn13: isbn,
    title,
    subtitle: clean(raw.subtitle),
    authors,
    publisher: clean(raw.publishers?.[0]),
    published: clean(raw.publish_date),
    pageCount: positiveInt(raw.number_of_pages),
    language: languageCode(raw.languages?.[0]?.key),
    workKey: workId(raw.works?.[0]?.key),
    cover: coverId ? `ol-${coverId}-M` : null,
  };
}

export function openLibrary(fetchFn: Fetch) {
  const name = 'openlibrary';
  return {
    async searchWorks(query: string): Promise<WorkSummary[]> {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20&fields=${SEARCH_FIELDS}`;
      const body = await getJson<{ docs?: OlSearchDoc[] }>(fetchFn, name, url);
      return (body?.docs ?? []).map(toWorkSummary).filter((w): w is WorkSummary => w !== null);
    },

    async work(key: string): Promise<WorkSummary | null> {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(`key:/works/${key}`)}&fields=${SEARCH_FIELDS}`;
      const body = await getJson<{ docs?: OlSearchDoc[] }>(fetchFn, name, url);
      return body?.docs?.[0] ? toWorkSummary(body.docs[0]) : null;
    },

    /**
     * Books people are reading this week, for an empty shelf to start from: only well-known ones (many
     * editions) with a cover. Falls back to classics when the week is thin.
     */
    async popular(): Promise<WorkSummary[]> {
      const known = (docs: OlSearchDoc[] | undefined) =>
        (docs ?? []).filter((d) => d.cover_i && (d.edition_count ?? 0) >= 10).map(toWorkSummary).filter((w): w is WorkSummary => w !== null);
      // Novels people are reading this week (a book club's kind of book), not the week's self-help.
      const week = await getJson<{ works?: OlSearchDoc[] }>(
        fetchFn,
        name,
        'https://openlibrary.org/trending/weekly.json?limit=100&fields=key,title,author_name,cover_i,edition_count,first_publish_year,subject_key',
      );
      const trending = known(week?.works?.filter(isAdultFiction));
      if (trending.length >= 6) return trending.slice(0, 12);
      const classics = await getJson<{ works?: (OlSearchDoc & { authors?: { name: string }[]; cover_id?: number })[] }>(
        fetchFn,
        name,
        'https://openlibrary.org/subjects/classic_literature.json?limit=24',
      );
      // The subjects API names a few fields differently.
      const docs = (classics?.works ?? []).map((w) => ({ ...w, author_name: w.authors?.map((a) => a.name), cover_i: w.cover_id }));
      return [...trending, ...known(docs)].slice(0, 12);
    },

    /** Up to 100 editions of a work. Open Library lists authors per work, so they're passed in. */
    async editions(key: string, authors: string[]): Promise<ProviderEdition[]> {
      const body = await getJson<{ entries?: OlEdition[] }>(fetchFn, name, `https://openlibrary.org/works/${key}/editions.json?limit=100`);
      return (body?.entries ?? []).map((e) => fromOlEdition(e, authors)).filter((e): e is ProviderEdition => e !== null);
    },

    /** The edition with this ISBN; authors are empty (the service fills them in from the work). */
    async isbn(isbn13: string): Promise<ProviderEdition | null> {
      const raw = await getJson<OlEdition>(fetchFn, name, `https://openlibrary.org/isbn/${isbn13}.json`);
      const found = raw ? fromOlEdition(raw, []) : null;
      return found && { ...found, isbn13 };
    },
  };
}

// ---- Google Books ------------------------------------------------------------------------------------

interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    language?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    imageLinks?: Record<string, string>;
  };
}

export function googleBooks(fetchFn: Fetch, apiKey: string) {
  const name = 'google';
  return {
    async isbn(isbn13: string): Promise<ProviderEdition | null> {
      const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}&maxResults=1&key=${encodeURIComponent(apiKey)}`;
      const body = await getJson<{ items?: GoogleVolume[] }>(fetchFn, name, url);
      const volume = body?.items?.[0];
      const info = volume?.volumeInfo;
      const title = clean(info?.title);
      if (!volume || !info || !title) return null;
      const language = clean(info.language);
      return {
        source: 'google',
        sourceId: volume.id,
        isbn13,
        title,
        subtitle: clean(info.subtitle),
        authors: info.authors?.slice(0, 10) ?? [],
        publisher: clean(info.publisher),
        published: clean(info.publishedDate),
        pageCount: positiveInt(info.pageCount),
        language: language ? (LANGUAGE_639_2[language] ?? language) : null,
        workKey: null,
        cover: info.imageLinks ? `g-${volume.id}` : null,
      };
    },
  };
}

// ---- Covers -------------------------------------------------------------------------------------------

const MAX_COVER_BYTES = 2 * 1024 * 1024;

/** The provider URL for a cover key; keys are validated against COVER_KEY first, so no other URL is ever fetched. */
export function coverUrl(key: string): string {
  if (key.startsWith('ol-')) {
    const [, id, size] = key.split('-');
    return `https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false`;
  }
  return `https://books.google.com/books/content?id=${encodeURIComponent(key.slice(2))}&printsec=frontcover&img=1&zoom=1`;
}

/** The image, or null when the provider has none. */
export async function fetchCover(fetchFn: Fetch, key: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  let res: Response;
  try {
    res = await fetchFn(coverUrl(key), { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ProviderError('covers', null, `cover unreachable: ${(err as Error).message}`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ProviderError('covers', res.status, `cover answered ${res.status}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (!/^image\/(jpeg|png|gif|webp)$/.test(contentType.split(';')[0]?.trim() ?? '')) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_COVER_BYTES) return null;
  return { contentType: contentType.split(';')[0]!.trim(), bytes };
}
