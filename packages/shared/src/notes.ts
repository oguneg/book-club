import { z } from 'zod';
import { positionToPage, POSITION_SCALE } from './position';

export const MAX_NOTE_LENGTH = 2000;
/** Distinct reporters that hide a public note until someone reviews it. */
export const REPORTS_TO_HIDE = 3;
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🤔'] as const;

export const noteVisibility = z.enum(['private', 'club', 'public']);
export type NoteVisibility = z.infer<typeof noteVisibility>;

const reactionSummary = z.object({ emoji: z.enum(REACTIONS), count: z.number().int(), mine: z.boolean() });

const noteFields = {
  id: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  mine: z.boolean(),
  /** null when the note was deleted but its replies remain. */
  body: z.string().nullable(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  reactions: z.array(reactionSummary),
  /** The viewer may delete it as a club owner/admin. */
  canModerate: z.boolean(),
};

export const noteReply = z.object(noteFields);
export type NoteReply = z.infer<typeof noteReply>;

export const note = z.object({
  ...noteFields,
  visibility: noteVisibility,
  club: z.object({ id: z.string(), name: z.string() }).nullable(),
  position: z.number().int().min(0).max(POSITION_SCALE),
  /** The page in the author's edition (null when they logged a percentage). */
  page: z.number().int().nullable(),
  editionId: z.string(),
  replies: z.array(noteReply),
});
export type Note = z.infer<typeof note>;

/** Where the viewer is in this book, for spoiler protection and "≈ p.N" in their own edition. */
export const noteViewer = z.object({
  position: z.number().int(),
  editionId: z.string(),
  startPage: z.number().int(),
  endPage: z.number().int(),
});
export type NoteViewer = z.infer<typeof noteViewer>;

export const notesResponse = z.object({ viewer: noteViewer.nullable(), notes: z.array(note) });
export const noteResponse = z.object({ note });

export const createNoteInput = z
  .object({
    readingId: z.string().uuid(),
    page: z.number().int().min(0).optional(),
    percent: z.number().min(0).max(100).optional(),
    body: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
    visibility: noteVisibility,
    clubId: z.string().uuid().optional(),
  })
  .refine((n) => (n.page === undefined) !== (n.percent === undefined), { message: 'Give a page or a percent', path: ['page'] })
  .refine((n) => (n.visibility === 'club') === Boolean(n.clubId), { message: 'Club notes need a club', path: ['clubId'] });

export const noteBodyInput = z.object({ body: z.string().trim().min(1).max(MAX_NOTE_LENGTH) });
export const reactionInput = z.object({ emoji: z.enum(REACTIONS) });
export const reportInput = z.object({ reason: z.enum(['spoiler', 'offensive', 'spam', 'other']), details: z.string().trim().max(500).optional() });

/** A note (or reply) with open reports, as moderators see it. */
export const reportedNote = z.object({
  id: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  body: z.string().nullable(),
  isReply: z.boolean(),
  visibility: noteVisibility,
  club: z.object({ id: z.string(), name: z.string() }).nullable(),
  bookTitle: z.string(),
  page: z.number().int().nullable(),
  position: z.number().int(),
  createdAt: z.string(),
  /** Hidden from everyone but its author because enough people reported it. */
  hidden: z.boolean(),
  reports: z.array(
    z.object({ reason: reportInput.shape.reason, details: z.string().nullable(), reporter: z.string(), createdAt: z.string() }),
  ),
});
export type ReportedNote = z.infer<typeof reportedNote>;
export const reportQueueResponse = z.object({ notes: z.array(reportedNote) });

export const blockedUser = z.object({ id: z.string(), name: z.string(), blockedAt: z.string() });
export const blockListResponse = z.object({ blocked: z.array(blockedUser) });

/** Spoiler rule: anything placed past where the viewer is reading. No reading yet = everything past the start. */
export function isSpoilerFor(notePosition: number, viewer: NoteViewer | null): boolean {
  return notePosition > (viewer?.position ?? 0);
}

/** How a note's place reads for this viewer: their exact page, "≈" another edition's page, or a percentage. */
export function notePlace(n: Pick<Note, 'position' | 'page' | 'editionId'>, viewer: NoteViewer | null): { page: number | null; approximate: boolean; percent: number } {
  const percent = Math.round((n.position / POSITION_SCALE) * 100);
  if (viewer && viewer.editionId === n.editionId && n.page !== null) return { page: n.page, approximate: false, percent };
  if (viewer) return { page: positionToPage(n.position, viewer), approximate: true, percent };
  return { page: null, approximate: false, percent };
}
