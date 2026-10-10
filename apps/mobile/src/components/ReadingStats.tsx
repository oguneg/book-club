import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useReadingStats } from '@/api/readings';
import { calendarOf, dayLevel, WEEKS } from '@/readings/calendar';
import { BookCover } from '@/components/BookCover';
import { TextButton } from '@/components/ui/TextButton';
import { useTheme } from '@/theme';

const CELL_GAP = 3;

/**
 * Your reading, gently counted: no streaks, no goals, nothing to keep up. Three numbers, a quiet calendar of
 * the days you read (with the same in words, and as a list), and this year's shelf.
 */
export function ReadingStats() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const stats = useReadingStats();
  const [today] = useState(() => new Date());
  const cal = useMemo(() => (stats.data ? calendarOf(stats.data, today) : null), [stats.data, today]);
  const [focus, setFocus] = useState<{ date: Date; pages: number } | null>(null);
  const [asList, setAsList] = useState(false);
  const year = today.getFullYear();
  const number = (n: number) => new Intl.NumberFormat().format(n);
  const dayName = (d: Date) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);

  if (stats.isPending) return <ActivityIndicator color={colors.accent} />;
  if (!stats.data || !cal) return null;
  const s = stats.data;

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Tile value={number(cal.weekPages)} label={t('stats.weekPages', { count: cal.weekPages })} />
        <Tile value={number(s.finishedThisYear.length)} label={t('stats.yearBooks', { count: s.finishedThisYear.length, year })} />
        <Tile value={number(s.pagesThisYear)} label={t('stats.yearPages', { count: s.pagesThisYear, year })} />
      </View>

      <View style={{ gap: space.sm }}>
        <Text accessibilityRole="header" aria-level={3} style={{ fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.text }}>
          {t('stats.calendarTitle')}
        </Text>
        {/* The grid is the picture; the caption below says it in words (and the day under your finger). */}
        <View aria-hidden style={{ flexDirection: 'row', gap: CELL_GAP }}>
          {cal.weeks.map((week, w) => (
            <View key={w} style={{ flex: 1, gap: CELL_GAP }}>
              {week.map((c) => (
                <Pressable
                  key={c.day}
                  focusable={false}
                  disabled={c.future}
                  onPress={() => setFocus({ date: c.date, pages: c.pages })}
                  onHoverIn={() => setFocus({ date: c.date, pages: c.pages })}
                  onHoverOut={() => setFocus(null)}
                  style={{ aspectRatio: 1, borderRadius: 3, backgroundColor: c.future ? 'transparent' : colors.calendar[dayLevel(c.pages)] }}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.textMuted, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>
            {focus
              ? t('stats.day', { day: dayName(focus.date), count: focus.pages })
              : t('stats.daysRead', { count: cal.daysRead.length, weeks: WEEKS })}
          </Text>
          <View aria-hidden style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{t('stats.less')}</Text>
            {colors.calendar.map((c) => (
              <View key={c} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
            ))}
            <Text style={{ color: colors.textMuted, fontSize: fontSize.xs }}>{t('stats.more')}</Text>
          </View>
        </View>
        {cal.daysRead.length > 0 && (
          <View style={{ alignSelf: 'flex-start' }}>
            <TextButton tone="muted" label={asList ? t('stats.hideDays') : t('stats.showDays')} onPress={() => setAsList((v) => !v)} />
          </View>
        )}
        {asList && (
          <View role="list" style={{ gap: 2 }}>
            {[...cal.daysRead].reverse().map((c) => (
              <View key={c.day} role="listitem" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{dayName(c.date)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, fontVariant: ['tabular-nums'] }}>{t('stats.pages', { count: c.pages })}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {s.finishedThisYear.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text accessibilityRole="header" aria-level={3} style={{ fontFamily: fonts.heading, fontSize: fontSize.md, color: colors.text }}>
            {t('stats.shelfTitle', { year })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {s.finishedThisYear.map((b) => (
              <Pressable key={b.id} accessibilityRole="link" accessibilityLabel={b.title} onPress={() => router.push({ pathname: '/readings/[id]', params: { id: b.id } })}>
                <BookCover cover={b.cover} title={b.title} size="md" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/** One number and what it counts. */
function Tile({ value, label }: { value: string; label: string }) {
  const { colors, fontSize, radius, space } = useTheme();
  return (
    <View style={{ flex: 1, padding: space.md, gap: 2, borderRadius: radius.md + 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontSize: fontSize.xl, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: fontSize.xs, lineHeight: fontSize.xs * 1.35 }}>{label}</Text>
    </View>
  );
}
