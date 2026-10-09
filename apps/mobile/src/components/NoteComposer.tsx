import { MAX_NOTE_LENGTH, type ReadingDetail } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { useNoteActions } from '@/api/notes';
import { useReading } from '@/api/readings';
import { noteErrorMessage } from '@/notes/errors';
import { Button } from '@/components/ui/Button';
import { Choice } from '@/components/ui/Choice';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { TextButton } from '@/components/ui/TextButton';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme';

/** Who a new note is for: only me, one of my clubs reading this book, or everyone reading it. */
export type Audience = 'private' | 'public' | `club:${string}`;

interface ComposerProps {
  readingId: string;
  bookKey: string;
  /** The choices, first one selected. A single choice hides the picker. */
  audiences: { value: Audience; label: string }[];
  onAdded: () => void;
  onCancel: () => void;
}

export function NoteComposer({ readingId, ...props }: ComposerProps) {
  const { colors } = useTheme();
  const reading = useReading(readingId).data;
  if (!reading) return <ActivityIndicator color={colors.accent} />;
  return <ComposerForm reading={reading} {...props} />;
}

function ComposerForm({ reading, bookKey, audiences, onAdded, onCancel }: Omit<ComposerProps, 'readingId'> & { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useNoteActions(bookKey);
  // Notes are placed where you are now, in the same terms you log progress (pages, or % for e-books).
  const lastWasPercent = reading.history.length > 0 && reading.history[reading.history.length - 1]?.page === null;
  const [mode, setMode] = useState<'page' | 'percent'>(lastWasPercent ? 'percent' : 'page');
  const [place, setPlace] = useState(lastWasPercent ? String(Math.round(reading.position / 100)) : String(reading.currentPage ?? reading.startPage));
  const [audience, setAudience] = useState<Audience>(audiences[0]?.value ?? 'private');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string>();
  const [placeError, setPlaceError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const clubName = audiences.find((a) => a.value === audience)?.label ?? '';

  async function save() {
    const n = Number(place.replace(',', '.'));
    if (mode === 'page' && (!place || !Number.isInteger(n) || n < 0 || n > reading.endPage)) {
      setPlaceError(t('reading.pageInvalid', { max: reading.endPage }));
      return;
    }
    if (mode === 'percent' && (!place || Number.isNaN(n) || n < 0 || n > 100)) {
      setPlaceError(t('reading.percentInvalid'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const club = audience.startsWith('club:') ? audience.slice(5) : undefined;
      await actions.create({
        readingId: reading.id,
        body: body.trim(),
        visibility: club ? 'club' : (audience as 'private' | 'public'),
        clubId: club,
        ...(mode === 'page' ? { page: n } : { percent: n }),
      });
      onAdded();
    } catch (err) {
      setError(noteErrorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <TextField
        label={t('notes.bodyLabel')}
        placeholder={t('notes.bodyPlaceholder')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={MAX_NOTE_LENGTH}
        autoFocus
      />
      <View style={{ gap: space.xs }}>
        <View style={{ maxWidth: 220 }}>
          <TextField
            label={mode === 'page' ? t('notes.atPage') : t('notes.atPercent')}
            value={place}
            onChangeText={(v) => {
              setPlace(mode === 'page' ? v.replace(/\D/g, '') : v.replace(/[^\d.,]/g, ''));
              setPlaceError(undefined);
            }}
            inputMode={mode === 'page' ? 'numeric' : 'decimal'}
            maxLength={5}
            error={placeError}
          />
        </View>
        <View style={{ alignSelf: 'flex-start' }}>
          <TextButton
            label={mode === 'page' ? t('notes.usePercent') : t('notes.usePage')}
            onPress={() => {
              setMode(mode === 'page' ? 'percent' : 'page');
              setPlace('');
              setPlaceError(undefined);
            }}
          />
        </View>
      </View>
      {audiences.length > 1 && <Choice label={t('notes.audienceLabel')} options={audiences} value={audience} onChange={setAudience} />}
      <Hint>
        {audience === 'private'
          ? t('notes.audienceHint_private')
          : audience === 'public'
            ? t('notes.audienceHint_public')
            : t('notes.audienceHint_club', { club: clubName })}
      </Hint>
      {error && <Notice message={error} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Button label={t('notes.add')} onPress={() => void save()} loading={busy} disabled={!body.trim()} />
        <Button variant="secondary" label={t('common.cancel')} onPress={onCancel} disabled={busy} />
      </View>
    </View>
  );
}
