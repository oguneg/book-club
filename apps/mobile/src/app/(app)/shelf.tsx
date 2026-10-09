import type { Reading } from '@bookclub/shared';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useReadings } from '@/api/readings';
import { formatAuthors } from '@/books/format';
import { formatDate } from '@/clubs/format';
import { readingErrorMessage } from '@/readings/errors';
import { readingLine } from '@/readings/format';
import { BookCover } from '@/components/BookCover';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

/** Books finished or stopped, face out like a shelf of covers. (Books in progress are on the home page.) */
export default function Shelf() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const readings = useReadings();
  const done = readings.data?.filter((r) => r.status !== 'reading') ?? [];

  return (
    <Screen width="wide">
      <PageTitle title={t('reading.shelfTitle')} />
      <BackLink href="/" label={t('appName')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text }}>
        {t('reading.shelfTitle')}
      </Text>
      <View style={{ marginTop: space.xl, gap: space.md }}>
        {readings.isPending && <ActivityIndicator color={colors.accent} />}
        {readings.isError && <Notice message={readingErrorMessage(t, readings.error)} />}
        {readings.isSuccess && done.length === 0 && <Hint>{t('reading.shelfEmpty')}</Hint>}
        <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xl }}>
          {done.map((r) => (
            <ShelfBook key={r.id} reading={r} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function ShelfBook({ reading }: { reading: Reading }) {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const when = reading.finishedAt
    ? t('reading.shelfFinished', { date: formatDate(reading.finishedAt.slice(0, 10)) })
    : t('reading.shelfStopped', { progress: readingLine(t, reading) });
  return (
    <View role="listitem" style={{ width: 128 }}>
      <Link
        href={{ pathname: '/readings/[id]', params: { id: reading.id } }}
        aria-label={[reading.edition.title, formatAuthors(reading.edition.authors), when].join(', ')}
        style={{ gap: space.sm }}
      >
        <View style={{ gap: space.sm }}>
          <BookCover cover={reading.edition.cover} title={reading.edition.title} size="lg" />
          <View style={{ gap: 2 }}>
            <Text numberOfLines={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.35, color: colors.text }}>
              {reading.edition.title}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: fontSize.xs, color: colors.textMuted }}>
              {when}
            </Text>
          </View>
        </View>
      </Link>
    </View>
  );
}
