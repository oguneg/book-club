import { MAX_NOTE_LENGTH } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useClubs } from '@/api/clubs';
import { useNoteActions } from '@/api/notes';
import { useReading } from '@/api/readings';
import { noteErrorMessage } from '@/notes/errors';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { TextButton } from '@/components/ui/TextButton';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

type Audience = 'private' | 'public' | `club:${string}`;

/**
 * Write a note: type, Post. It's placed at your page (changeable) and goes to your club when you're
 * reading this book in one, otherwise to everyone reading it; "Only me" is one tap away.
 */
export function NoteSheet({
  readingId,
  bookKey,
  visible,
  onClose,
  onPosted,
  clubId,
}: {
  readingId: string;
  bookKey: string;
  visible: boolean;
  onClose: () => void;
  onPosted: () => void;
  /** On a club's page: that club first. */
  clubId?: string;
}) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const reading = useReading(readingId).data;
  const clubs = useClubs().data ?? [];
  const actions = useNoteActions(bookKey);
  const myClubs = clubs.filter((c) => c.currentBook?.bookKey === bookKey).sort((a, b) => (a.id === clubId ? -1 : b.id === clubId ? 1 : 0));
  const club = myClubs[0];
  const [audience, setAudience] = useState<Audience | null>(null);
  const chosen: Audience = audience ?? (club ? `club:${club.id}` : 'public');
  const [body, setBody] = useState('');
  const [page, setPage] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const atPage = page ?? String(reading?.currentPage ?? reading?.startPage ?? 1);

  const options: { value: Audience; label: string }[] = [
    ...(club ? [{ value: `club:${club.id}` as const, label: t('notes.audience_club') }] : []),
    { value: 'public', label: t('notes.audience_public') },
    { value: 'private', label: t('notes.audience_private') },
  ];

  const close = () => {
    setBody('');
    setPage(null);
    setAudience(null);
    setError(undefined);
    onClose();
  };

  async function post() {
    if (!reading || !body.trim()) return;
    const n = Number(atPage);
    if (!Number.isInteger(n) || n < 0 || n > reading.endPage) return setError(t('reading.pageInvalid', { max: reading.endPage }));
    setBusy(true);
    setError(undefined);
    try {
      const target = chosen.startsWith('club:') ? chosen.slice(5) : undefined;
      await actions.create({ readingId, body: body.trim(), page: n, visibility: target ? 'club' : (chosen as 'public' | 'private'), clubId: target });
      close();
      onPosted();
    } catch (err) {
      setError(noteErrorMessage(t, err));
    }
    setBusy(false);
  }

  return (
    <Sheet visible={visible} onClose={close} title={t('notes.sheet.title', { page: atPage })}>
      <View style={{ gap: space.md, paddingBottom: space.sm }}>
        <TextField
          label={t('notes.bodyLabel')}
          placeholder={t('notes.bodyPlaceholder')}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={MAX_NOTE_LENGTH}
          autoFocus
        />
        {page === null ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <TextButton tone="muted" label={t('notes.sheet.changePage')} onPress={() => setPage(atPage)} />
          </View>
        ) : (
          <View style={{ maxWidth: 160 }}>
            <TextField label={t('notes.atPage')} value={page} onChangeText={(v) => setPage(v.replace(/\D/g, ''))} inputMode="numeric" maxLength={5} />
          </View>
        )}
        <Segmented kind="radio" label={t('notes.audienceLabel')} options={options} value={chosen} onChange={setAudience} />
        <Hint>
          {chosen === 'private' ? t('notes.audienceHint_private') : chosen === 'public' ? t('notes.audienceHint_public') : t('notes.audienceHint_club', { club: club?.name ?? '' })}
        </Hint>
        {error && <Notice message={error} />}
        <Button label={t('notes.sheet.post')} onPress={() => void post()} loading={busy} disabled={!body.trim() || !reading} />
      </View>
    </Sheet>
  );
}
