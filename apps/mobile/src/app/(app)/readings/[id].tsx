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
import { BookSpan } from '@/components/BookSpan';
import { Columns } from '@/components/Columns';
import { LogProgress } from '@/components/LogProgress';
import { Notes } from '@/components/Notes';
import { PageRangeFields, parsePageRange } from '@/components/PageRangeFields';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Button } from '@/components/ui/Button';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { Desk } from '@/components/ui/Desk';
import { Notice } from '@/components/ui/Notice';
import { Hint, Section } from '@/components/ui/Section';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

/** One book you're reading: where you are, the notes up to there, and the rest of its record beside it. */
export default function ReadingPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useReading(id);
  const reading = query.data;

  return (
    <Screen width="wide">
      <PageTitle title={reading?.edition.title} />
      <BackLink href="/" label={t('appName')} />
      {query.isPending && <ActivityIndicator color={colors.accent} />}
      {query.isError && <Notice message={readingErrorMessage(t, query.error)} />}
      {reading && (
        <Columns
          railLabel={t('reading.record')}
          main={
            <>
              <Header reading={reading} />
              {reading.status === 'reading' ? (
                <Desk label={t('reading.log')}>
                  <LogProgress reading={reading} />
                </Desk>
              ) : (
                <Closed reading={reading} />
              )}
              <Notes bookKey={reading.bookKey} readingId={reading.id} />
            </>
          }
          rail={
            <>
              <History reading={reading} />
              <Pages key={`${reading.startPage}-${reading.endPage}`} reading={reading} />
              <ThisBook reading={reading} />
            </>
          }
        />
      )}
    </Screen>
  );
}

function Header({ reading }: { reading: ReadingDetail }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const dates = [
    t('reading.started', { date: formatDate(reading.startedAt.slice(0, 10)) }),
    reading.finishedAt ? t('reading.finishedOn', { date: formatDate(reading.finishedAt.slice(0, 10)) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', gap: space.lg, alignItems: 'flex-end' }}>
        <BookCover cover={reading.edition.cover} title={reading.edition.title} size="md" />
        <View style={{ flex: 1, gap: space.xs }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, lineHeight: fontSize.xl * 1.2, color: colors.text }}>
            {reading.edition.title}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.md }}>{formatAuthors(reading.edition.authors)}</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.md, fontVariant: ['tabular-nums'], marginTop: space.xs }}>{readingLine(t, reading)}</Text>
          <Hint>{dates}</Hint>
        </View>
      </View>
      <BookSpan position={reading.position} startPage={reading.startPage} endPage={reading.endPage} label={readingLine(t, reading)} />
    </View>
  );
}

/** A finished or stopped book: say so, and offer to pick it up again. */
function Closed({ reading }: { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const actions = useReadingActions(reading.id);
  const [error, setError] = useState<string>();
  return (
    <Desk>
      <Text style={{ fontSize: fontSize.md, lineHeight: fontSize.md * 1.5, color: colors.text }}>{reading.status === 'finished' ? t('reading.closedFinished') : t('reading.closedStopped')}</Text>
      {error && <Notice message={error} />}
      <View style={{ alignSelf: 'flex-start', marginTop: space.xs }}>
        <Button variant="secondary" label={t('reading.resume')} onPress={() => actions.resume().catch((err) => setError(readingErrorMessage(t, err)))} />
      </View>
    </Desk>
  );
}

function History({ reading }: { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  const [all, setAll] = useState(false);
  const entries = [...reading.history].reverse();
  const shown = all ? entries.slice(0, 60) : entries.slice(0, 6);
  return (
    <Section title={t('reading.history')}>
      {entries.length === 0 && <Hint>{t('reading.noHistory')}</Hint>}
      <View style={{ gap: space.sm }}>
        {shown.map((h) => (
          <View key={h.at} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{formatMeetingTime(h.at)}</Text>
            <Text style={{ color: colors.text, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>
              {readingLine(t, { status: 'reading', position: h.position, currentPage: h.page, endPage: reading.endPage })}
            </Text>
          </View>
        ))}
      </View>
      {entries.length > shown.length && (
        <View style={{ alignSelf: 'flex-start' }}>
          <TextButton tone="muted" label={t('reading.showAllHistory', { count: entries.length })} onPress={() => setAll(true)} />
        </View>
      )}
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
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Button label={t('reading.savePages')} onPress={save} loading={busy} />
            <Button variant="secondary" label={t('common.cancel')} onPress={() => setEditing(false)} disabled={busy} />
          </View>
        </View>
      ) : (
        <View style={{ alignSelf: 'flex-start' }}>
          <TextButton label={t('reading.changePages')} onPress={() => setEditing(true)} />
        </View>
      )}
    </Section>
  );
}

/** The rarely needed decisions, kept out of the way: finished it, stop, remove. */
function ThisBook({ reading }: { reading: ReadingDetail }) {
  const { t } = useTranslation();
  const { space } = useTheme();
  const actions = useReadingActions(reading.id);
  const [error, setError] = useState<string>();
  const attempt = (action: () => Promise<unknown>) => () => action().catch((err) => setError(readingErrorMessage(t, err)));
  return (
    <Section title={t('reading.thisBook')}>
      {error && <Notice message={error} />}
      <View style={{ gap: space.sm }}>
        {reading.status === 'reading' && (
          <>
            <ConfirmButton quiet label={t('reading.finishIt')} question={t('reading.finishQuestion')} confirmLabel={t('reading.finishConfirm')} onConfirm={attempt(actions.finish)} />
            <ConfirmButton quiet label={t('reading.stop')} question={t('reading.stopQuestion')} confirmLabel={t('reading.stopConfirm')} onConfirm={attempt(actions.stop)} />
          </>
        )}
        <ConfirmButton
          quiet
          label={t('reading.remove')}
          question={t('reading.removeQuestion')}
          confirmLabel={t('reading.removeConfirm')}
          danger
          onConfirm={async () => {
            await actions.remove();
            router.dismissTo('/');
          }}
        />
      </View>
    </Section>
  );
}
