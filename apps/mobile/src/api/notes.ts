import { blockListResponse, notesResponse, type createNoteInput, type Note, type NoteReply, type reportInput } from '@bookclub/shared';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';

/** Which notes on a book: everything I may see, only public ones, one club's, or my own. */
export type NoteScope = 'all' | 'public' | 'mine' | `club:${string}`;
export type Reaction = Note['reactions'][number]['emoji'];
export type ReportReason = z.infer<typeof reportInput>['reason'];

export function useNotes(bookKey: string, scope: NoteScope) {
  return useQuery({
    queryKey: ['notes', bookKey, scope],
    queryFn: ({ signal }) => apiGet(`/api/notes?book=${encodeURIComponent(bookKey)}&scope=${encodeURIComponent(scope)}`, notesResponse, signal),
  });
}

export function useBlocks() {
  return useQuery({
    queryKey: ['blocks'],
    queryFn: async ({ signal }) => (await apiGet('/api/blocks', blockListResponse, signal)).blocked,
  });
}

const created = z.object({ id: z.string() });
const nothing = z.undefined();
const at = (id: string) => `/api/notes/${encodeURIComponent(id)}`;

/** My reaction toggled on one note or reply, in every cached list of this book's notes. */
function toggleReaction(queryClient: QueryClient, bookKey: string, id: string, emoji: Reaction) {
  const toggle = <T extends NoteReply>(n: T): T => {
    if (n.id !== id) return n;
    const existing = n.reactions.find((r) => r.emoji === emoji);
    const reactions = !existing
      ? [...n.reactions, { emoji, count: 1, mine: true }]
      : existing.mine
        ? n.reactions.flatMap((r) => (r !== existing ? [r] : r.count > 1 ? [{ ...r, count: r.count - 1, mine: false }] : []))
        : n.reactions.map((r) => (r === existing ? { ...r, count: r.count + 1, mine: true } : r));
    return { ...n, reactions };
  };
  queryClient.setQueriesData<z.infer<typeof notesResponse>>({ queryKey: ['notes', bookKey] }, (data) =>
    data ? { ...data, notes: data.notes.map((n) => ({ ...toggle(n), replies: n.replies.map(toggle) })) } : data,
  );
}

/** Note changes on one book. Each refetches that book's notes (live updates tell other readers). */
export function useNoteActions(bookKey: string) {
  const queryClient = useQueryClient();
  const refresh = async <T>(request: Promise<T>): Promise<T> => {
    const result = await request;
    await queryClient.invalidateQueries({ queryKey: ['notes', bookKey] });
    return result;
  };
  return {
    create: (input: z.input<typeof createNoteInput>) => refresh(apiPost('/api/notes', input, created)),
    reply: (id: string, body: string) => refresh(apiPost(`${at(id)}/replies`, { body }, created)),
    edit: (id: string, body: string) => refresh(apiPatch(at(id), { body }, nothing)),
    remove: (id: string) => refresh(apiDelete(at(id), nothing)),
    report: (id: string, reason: ReportReason) => refresh(apiPost(`${at(id)}/report`, { reason }, nothing)),
    react: async (id: string, emoji: Reaction) => {
      toggleReaction(queryClient, bookKey, id, emoji);
      try {
        await apiPost(`${at(id)}/reactions`, { emoji }, nothing);
      } finally {
        void queryClient.invalidateQueries({ queryKey: ['notes', bookKey] });
      }
    },
  };
}

/** Blocking hides notes both ways, on every book. */
export function useBlockActions() {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: ['notes'] }), queryClient.invalidateQueries({ queryKey: ['blocks'] })]);
  return {
    block: async (userId: string) => {
      await apiPut(`/api/blocks/${encodeURIComponent(userId)}`, {}, nothing);
      await refresh();
    },
    unblock: async (userId: string) => {
      await apiDelete(`/api/blocks/${encodeURIComponent(userId)}`, nothing);
      await refresh();
    },
  };
}
