import {
  clubListResponse,
  clubResponse,
  invitePreview,
  type ClubDetail,
} from '@bookclub/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './client';

export function useClubs() {
  return useQuery({
    queryKey: ['clubs'],
    queryFn: async ({ signal }) => (await apiGet('/api/clubs', clubListResponse, signal)).clubs,
  });
}

export function useClub(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['club', id],
    queryFn: async ({ signal }) => (await apiGet(`/api/clubs/${encodeURIComponent(id)}`, clubResponse, signal)).club,
    enabled: enabled && Boolean(id),
  });
}

export function useInvite(code: string) {
  return useQuery({
    queryKey: ['invite', code],
    queryFn: ({ signal }) => apiGet(`/api/invites/${encodeURIComponent(code)}`, invitePreview, signal),
    retry: false,
  });
}

const club = (res: { club: ClubDetail }) => res.club;
const nothing = z.undefined();

/**
 * Club changes. Every call returns the updated club, which replaces the cached copy; the club list is
 * refreshed too (names, books and member counts show there).
 */
export function useClubActions(id: string) {
  const queryClient = useQueryClient();
  const base = `/api/clubs/${encodeURIComponent(id)}`;
  const store = async (updated: Promise<ClubDetail>) => {
    const value = await updated;
    queryClient.setQueryData(['club', id], value);
    void queryClient.invalidateQueries({ queryKey: ['clubs'] });
    return value;
  };
  const gone = async (done: Promise<unknown>) => {
    await done;
    queryClient.removeQueries({ queryKey: ['club', id] });
    await queryClient.invalidateQueries({ queryKey: ['clubs'] });
  };

  return {
    update: (input: { name?: string; description?: string }) => store(apiPatch(base, input, clubResponse).then(club)),
    remove: () => gone(apiDelete(base, nothing)),
    leave: () => gone(apiPost(`${base}/leave`, {}, nothing)),
    rotateInvite: () => store(apiPost(`${base}/invite/rotate`, {}, clubResponse).then(club)),
    setRole: (userId: string, role: 'admin' | 'member') =>
      store(apiPatch(`${base}/members/${encodeURIComponent(userId)}`, { role }, clubResponse).then(club)),
    removeMember: (userId: string) => store(apiDelete(`${base}/members/${encodeURIComponent(userId)}`, clubResponse).then(club)),
    transfer: (userId: string) => store(apiPost(`${base}/transfer`, { userId }, clubResponse).then(club)),
    setBook: (input: { editionId: string; startDate?: string; finishDate?: string | null }) =>
      store(apiPut(`${base}/book`, input, clubResponse).then(club)),
    updateBook: (input: { startDate?: string; finishDate?: string | null }) => store(apiPatch(`${base}/book`, input, clubResponse).then(club)),
    finishBook: () => store(apiPost(`${base}/book/finish`, {}, clubResponse).then(club)),
    addMeeting: (input: MeetingInput) => store(apiPost(`${base}/meetings`, input, clubResponse).then(club)),
    updateMeeting: (meetingId: string, input: MeetingInput) =>
      store(apiPut(`${base}/meetings/${encodeURIComponent(meetingId)}`, input, clubResponse).then(club)),
    deleteMeeting: (meetingId: string) => store(apiDelete(`${base}/meetings/${encodeURIComponent(meetingId)}`, clubResponse).then(club)),
  };
}

export interface MeetingInput {
  startsAt: string;
  title: string;
  location: string | null;
  readToPage: number | null;
}

export async function createClub(input: { name: string; description?: string }) {
  return (await apiPost('/api/clubs', input, clubResponse)).club;
}

export async function joinClub(code: string) {
  return apiPost(`/api/invites/${encodeURIComponent(code)}/join`, {}, z.object({ clubId: z.string() }));
}
