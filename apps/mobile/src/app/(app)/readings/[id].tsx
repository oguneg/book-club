import type { ReadingDetail } from '@bookclub/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useReading, useReadingActions } from '@/api/readings';
import { formatAuthors } from '@/books/format';
import { formatDate, formatMeetingTime } from '@/clubs/format';
import { readingErrorMessage } from '@/readings/errors';
import { readingLine } from '@/readings/format';
import { BookCover } from '@/components/BookCover';
import { LogProgress } from '@/components/LogProgress';
import { Notes } from '@/components/Notes';
import { PageRangeFields, parsePageRange } from '@/components/PageRangeFields';
import { PageTitle } from '@/components/PageTitle';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { useTheme } from '@/theme';

export default function ReadingPage() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useReading(id);
  const reading = query.data;

  return (
    <Screen>
      <PageTitle title={reading?.edition.title} />
      <BackLink href="/" label={t('appName')} />
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={readingErrorMessage(t, query.error)} />}
      {reading && (
        <>
          <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-end' }}>
            <BookCover cover={reading.edition.cover} title={reading.edition.title} size="md" />
            <View style={{ flex: 1, gap: space.xs }}>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>
                {reading.edition.title}
              </Text>
              <Hint>{formatAuthors(reading.edition.authors)}</Hint>
            </View>
          </View>

          <View style={{ marginTop: space.xl, gap: space.sm }}>
            <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: '600' }}>{readingLine(t, reading)}</Text>
            <ProgressBar position={reading.position} label={readingLine(t, reading)} />
            <Hint>
              {[t('reading.started', { date: formatDate(reading.startedAt.slice(0, 10)) }), reading.finishedAt ? t('reading.finishedOn', { date: formatDate(reading.finishedAt.slice(0, 10)) }) : null]
                .filter(Boolean)
                .join(' · ')}
            </Hint>
          </View>

          <View style={{ marginTop: space.xl, gap: space.lg }}>
            {reading.status === 'reading' ? (
              <Section title={t('reading.log')}>
                <LogProgress reading={reading} />
                <StatusActions reading={reading} />
              </Section>
            ) : (
              <StatusActions reading={reading} />
            )}
            <Notes bookKey={reading.bookKey} readingId={reading.id} />
            <History reading={reading} />
            <Pages key={`${reading.startPage}-${reading.endPage}`} reading={reading} />
            <RemoveReading reading={reading} />
          </View>
        </>
      )}
    </Screen>
  );
}

function StatusActions({ reading }: { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useReadingActions(reading.id);
  const [error, setError] = useState<string>();
  const attempt = (action: () => Promise<unknown>) => () => action().catch((err) => setError(readingErrorMessage(t, err)));

  if (reading.status !== 'reading') {
    return (
      <View style={{ gap: space.sm }}>
        {error && <Notice message={error} />}
        <View style={{ alignSelf: 'flex-start' }}>
          <Button variant="secondary" label={t('reading.resume')} onPress={attempt(actions.resume)} />
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: space.sm }}>
      {error && <Notice message={error} />}
      <ConfirmButton label={t('reading.finishIt')} question={t('reading.finishQuestion')} confirmLabel={t('reading.finishConfirm')} onConfirm={attempt(actions.finish)} />
      <ConfirmButton label={t('reading.stop')} question={t('reading.stopQuestion')} confirmLabel={t('reading.stopConfirm')} onConfirm={attempt(actions.stop)} />
    </View>
  );
}

function History({ reading }: { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const entries = [...reading.history].reverse().slice(0, 30);
  return (
    <Section title={t('reading.history')}>
      {entries.length === 0 && <Hint>{t('reading.noHistory')}</Hint>}
      {entries.map((h) => (
        <View key={h.at} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{formatMeetingTime(h.at)}</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.sm }}>
            {readingLine(t, { status: 'reading', position: h.position, currentPage: h.page, endPage: reading.endPage })}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function Pages({ reading }: { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useReadingActions(reading.id);
  const [editing, setEditing] = useState(false);
  const [start, setStart] = useState(String(reading.startPage));
  const [end, setEnd] = useState(String(reading.endPage));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function save() {
    const range = parsePageRange(start, end);
    if (!range) {
      setError(t('reading.rangeInvalid'));
      return;
    }
    setBusy(true);
    try {
      await actions.setRange(range.startPage, range.endPage);
      setEditing(false);
      setError(undefined);
    } catch (err) {
      setError(readingErrorMessage(t, err));
    }
    setBusy(false);
  }

  return (
    <Section title={t('reading.pages')}>
      <Hint>{t('reading.pagesLine', { start: reading.startPage, end: reading.endPage })}</Hint>
      {editing ? (
        <View style={{ gap: space.md }}>
          <PageRangeFields start={start} end={end} onStart={setStart} onEnd={setEnd} error={error} />
          <View style={{ alignSelf: 'flex-start' }}>
            <Button label={t('reading.savePages')} onPress={save} loading={busy} />
          </View>
        </View>
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button variant="secondary" label={t('reading.changePages')} onPress={() => setEditing(true)} />
        </View>
      )}
    </Section>
  );
}

function RemoveReading({ reading }: { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const actions = useReadingActions(reading.id);
  return (
    <ConfirmButton
      label={t('reading.remove')}
      question={t('reading.removeQuestion')}
      confirmLabel={t('reading.removeConfirm')}
      danger
      onConfirm={async () => {
        await actions.remove();
        router.dismissTo('/');
      }}
    />
  );
}
