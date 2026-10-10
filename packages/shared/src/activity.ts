import { z } from 'zod';

// What happened in your clubs lately, for Home: who read how far, who left a note (only its text when
// you've reached that place), who finished, who joined. Only the club's book counts: what members read on
// their own stays theirs.

const person = z.object({ id: z.string(), name: z.string(), image: z.string().nullable() });
const club = z.object({ id: z.string(), name: z.string() });
const book = z.object({ title: z.string(), cover: z.string().nullable(), bookKey: z.string() });

const base = { id: z.string(), at: z.string(), person, club };

export const activityItem = z.discriminatedUnion('kind', [
  /** One reader's progress on one day: pages read in their own copy, and where they are now (0..10000). */
  z.object({ ...base, kind: z.literal('progress'), book, pages: z.number().int(), position: z.number().int() }),
  /** A club note, or a reply to one of yours. `body` is null while the note is past your place. */
  z.object({
    ...base,
    kind: z.literal('note'),
    book,
    noteId: z.string(),
    position: z.number().int(),
    body: z.string().nullable(),
    ahead: z.boolean(),
    replyToYou: z.boolean(),
  }),
  z.object({ ...base, kind: z.literal('finished'), book }),
  z.object({ ...base, kind: z.literal('joined') }),
]);
export type ActivityItem = z.infer<typeof activityItem>;

export const activityResponse = z.object({ items: z.array(activityItem) });
