import type { ReportedNote } from '@bookclub/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useModerationActions, useReportQueue } from '@/api/admin';
import { noteErrorMessage } from '@/notes/errors';
import { noteTime } from '@/notes/format';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { useTheme } from '@/theme';

/** Moderators review reported notes: keep each one (its reports are dismissed) or remove it. */
export default function ReportedNotes() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const query = useReportQueue();

  return (
    <Screen>
      <PageTitle title={t('admin.title')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text }}>
        {t('admin.title')}
      </Text>
      <View style={{ gap: space.lg, marginTop: space.lg }}>
        <Hint>{t('admin.intro')}</Hint>
        {query.isPending && <ActivityIndicator color={colors.accent} />}
        {/* Not a moderator: the API answers as if the page didn't exist. */}
        {query.isError && <Notice message={t('admin.notAllowed')} />}
        {query.data?.length === 0 && <Notice tone="info" message={t('admin.empty')} />}
        {query.data?.map((n) => (
          <Reported key={n.id} note={n} now={query.dataUpdatedAt} />
        ))}
      </View>
    </Screen>
  );
}

function Reported({ note, now }: { note: ReportedNote; now: number }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const { keep, remove } = useModerationActions();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const place = note.page !== null ? t('notes.place', { page: note.page }) : t('notes.placePercent', { percent: Math.round(note.position / 100) });
  const audience = note.club?.name ?? t(`notes.audience_${note.visibility}`);

  return (
    <Section title={note.bookTitle}>
      <Hint>{[place, audience, note.isReply ? t('admin.reply') : null].filter(Boolean).join(' · ')}</Hint>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{note.author.name}</Text>
        {` · ${noteTime(t, note.createdAt, now)}`}
      </Text>
      {note.hidden && <Notice message={t('admin.hidden')} />}
      {note.body === null ? (
        <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: fontSize.md }}>{t('notes.deleted')}</Text>
      ) : (
        <Text selectable style={{ fontFamily: fonts.reading, fontSize: fontSize.md, lineHeight: fontSize.md * 1.6, color: colors.text }}>
          {note.body}
        </Text>
      )}
      <View style={{ gap: space.sm }}>
        <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '600' }}>{t('admin.reports', { count: note.reports.length })}</Text>
        {note.reports.map((r, i) => (
          <View key={i} style={{ gap: 2 }}>
            <Hint>{[t(`notes.reason_${r.reason}`), r.reporter, noteTime(t, r.createdAt, now)].join(' · ')}</Hint>
            {r.details && <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{`“${r.details}”`}</Text>}
          </View>
        ))}
      </View>
      {error && <Notice message={error} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'flex-start' }}>
        <Button
          variant="secondary"
          label={t('admin.keep')}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await keep(note.id).catch((err) => setError(noteErrorMessage(t, err)));
            setBusy(false);
          }}
        />
        <ConfirmButton
          danger
          label={t('admin.remove')}
          question={t('admin.removeQuestion')}
          confirmLabel={t('admin.removeConfirm')}
          onConfirm={() => remove(note.id).catch((err) => setError(noteErrorMessage(t, err)))}
        />
      </View>
    </Section>
  );
}
