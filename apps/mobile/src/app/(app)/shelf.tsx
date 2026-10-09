import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';
import { useReadings } from '@/api/readings';
import { formatAuthors } from '@/books/format';
import { formatDate } from '@/clubs/format';
import { readingErrorMessage } from '@/readings/errors';
import { readingLine } from '@/readings/format';
import { BookRow } from '@/components/BookRow';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { BackLink } from '@/components/ui/BackLink';
import { Notice } from '@/components/ui/Notice';
import { Hint } from '@/components/ui/Section';
import { useTheme } from '@/theme';

// Books finished or stopped. (Books in progress are on the home page.)
export default function Shelf() {
  const { colors, fonts, fontSize, space } = useTheme();
  const { t } = useTranslation();
  const readings = useReadings();
  const done = readings.data?.filter((r) => r.status !== 'reading') ?? [];

  return (
    <Screen>
      <PageTitle title={t('reading.shelfTitle')} />
      <BackLink href="/" label={t('appName')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text }}>
        {t('reading.shelfTitle')}
      </Text>
      <View style={{ marginTop: space.xl, gap: space.xs }}>
        {readings.isPending && <ActivityIndicator color={colors.accent} />}
        {readings.isError && <Notice message={readingErrorMessage(t, readings.error)} />}
        {readings.isSuccess && done.length === 0 && <Hint>{t('reading.shelfEmpty')}</Hint>}
        {done.map((r) => (
          <BookRow
            key={r.id}
            href={{ pathname: '/readings/[id]', params: { id: r.id } }}
            cover={r.edition.cover}
            title={r.edition.title}
            lines={[
              formatAuthors(r.edition.authors),
              r.finishedAt ? t('reading.finishedOn', { date: formatDate(r.finishedAt.slice(0, 10)) }) : readingLine(t, r),
            ]}
          />
        ))}
      </View>
    </Screen>
  );
}
