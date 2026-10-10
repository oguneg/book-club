import { z } from 'zod';
import { edition } from './books';
import { isoDate } from './goals';

export const CLUB_MEMBER_CAP = 50;
export const MAX_CLUB_NAME = 80;
export const MAX_CLUB_DESCRIPTION = 500;

export const clubRole = z.enum(['owner', 'admin', 'member']);
export type ClubRole = z.infer<typeof clubRole>;

/** Owners can do everything admins can; admins everything members can. */
export function roleAtLeast(role: ClubRole | null | undefined, needed: ClubRole): boolean {
  const rank = { member: 0, admin: 1, owner: 2 } as const;
  return role !== null && role !== undefined && rank[role] >= rank[needed];
}

// ---- Invite codes: 8 characters without look-alikes (0/O, 1/I/L), shown as ABCD-EFGH. ----

export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 8;

/** What people type or paste ("abcd efgh", "ABCD-EFGH", a whole invite link) as a bare code, or null. */
export function normalizeInviteCode(input: string): string | null {
  const tail = input.trim().split('/').filter(Boolean).pop() ?? '';
  const code = tail.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== INVITE_LENGTH) return null;
  return [...code].every((ch) => INVITE_ALPHABET.includes(ch)) ? code : null;
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

// ---- API shapes ----

export const meeting = z.object({
  id: z.string(),
  /** ISO date-time. */
  startsAt: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  /** "Read up to page N" in the club's edition. */
  readToPage: z.number().int().nullable(),
});
export type Meeting = z.infer<typeof meeting>;

export const clubBook = z.object({
  id: z.string(),
  edition,
  status: z.enum(['current', 'finished']),
  /** YYYY-MM-DD. */
  startDate: z.string(),
  finishDate: z.string().nullable(),
  finishedAt: z.string().nullable(),
  meetings: z.array(meeting),
});
export type ClubBook = z.infer<typeof clubBook>;

export const clubMember = z.object({
  userId: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  role: clubRole,
  joinedAt: z.string(),
});
export type ClubMember = z.infer<typeof clubMember>;

export const clubDetail = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  inviteCode: z.string(),
  memberCap: z.number().int(),
  myRole: clubRole,
  members: z.array(clubMember),
  currentBook: clubBook.nullable(),
  pastBooks: z.array(clubBook),
});
export type ClubDetail = z.infer<typeof clubDetail>;

const bookGlimpse = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  cover: z.string().nullable(),
  /** Which book this is (see bookKeyOf), e.g. to offer club notes on it. */
  bookKey: z.string(),
});

export const clubSummary = z.object({
  id: z.string(),
  name: z.string(),
  role: clubRole,
  memberCount: z.number().int(),
  currentBook: bookGlimpse.nullable(),
  nextMeeting: z.string().nullable(),
});
export type ClubSummary = z.infer<typeof clubSummary>;

export const clubListResponse = z.object({ clubs: z.array(clubSummary) });
export const clubResponse = z.object({ club: clubDetail });

export const invitePreview = z.object({
  code: z.string(),
  club: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    memberCount: z.number().int(),
    currentBook: bookGlimpse.nullable(),
  }),
  isMember: z.boolean(),
  isFull: z.boolean(),
});
export type InvitePreview = z.infer<typeof invitePreview>;

// ---- Inputs ----

export const createClubInput = z.object({
  name: z.string().trim().min(1).max(MAX_CLUB_NAME),
  description: z.string().trim().max(MAX_CLUB_DESCRIPTION).optional(),
});
export const updateClubInput = createClubInput.partial();

export const setClubBookInput = z.object({
  editionId: z.string().uuid(),
  startDate: isoDate.optional(),
  finishDate: isoDate.nullable().optional(),
});
export const updateClubBookInput = z.object({
  startDate: isoDate.optional(),
  finishDate: isoDate.nullable().optional(),
});

export const meetingInput = z.object({
  startsAt: z.iso.datetime({ offset: true }),
  title: z.string().trim().min(1).max(120),
  location: z.string().trim().max(300).nullable().optional(),
  readToPage: z.number().int().min(1).nullable().optional(),
});

export const roleInput = z.object({ role: z.enum(['admin', 'member']) });
export const transferInput = z.object({ userId: z.string().min(1) });
