import type { TFunction } from 'i18next';
import { Rabbit, Target } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { ReadingTarget } from '@/readings/targets';
import { useTheme } from '@/theme';

/** The rabbit: where you'd be today at the pace you (or your club) set. A small round mark on a line. */
export function RabbitMark({ size = 22 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: colors.text,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Rabbit size={Math.round(size * 0.6)} color={colors.text} strokeWidth={2} />
    </View>
  );
}

/** "Fri" for a day this week, "30 Oct" further off. */
export function dayLabel(by: string, days: number): string {
  const [y, m, d] = by.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return new Intl.DateTimeFormat(undefined, days <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' }).format(date);
}

/** "19 pages a day to reach p. 120 by Fri", or the good news when you're already there. */
export function targetText(t: TFunction, target: ReadingTarget): string {
  const day = dayLabel(target.by, target.days);
  if (target.kind === 'meeting') {
    if (target.pages === 0) return t('pace.readyMeeting', { page: target.targetPage, day });
    return target.days === 1 ? t('pace.toPageToday', { count: target.pages, page: target.targetPage }) : t('pace.toPage', { count: target.pages, page: target.targetPage, day });
  }
  if (target.pages === 0) return t('pace.readyEnd', { day });
  return target.days === 1 ? t('pace.toEndToday', { count: target.pages }) : t('pace.toEnd', { count: target.pages, day });
}

/** "12 pages ahead of the rabbit" / "8 pages behind" / "Right with the rabbit". */
export function rabbitText(t: TFunction, pages: number): string {
  if (pages > 0) return t('pace.ahead', { count: pages });
  if (pages < 0) return t('pace.behind', { count: -pages });
  return t('pace.level');
}

/**
 * What today asks of you for one book: pages a day to the next target, and where you are against the rabbit.
 * Either line may be missing (no target set, no pace).
 */
export function PaceLines({ target, rabbitPages }: { target: ReadingTarget | null; rabbitPages: number | null }) {
  const { t } = useTranslation();
  const { colors, fontSize, space } = useTheme();
  if (!target && rabbitPages === null) return null;
  const text = { flex: 1, color: colors.text, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.4, fontVariant: ['tabular-nums' as const] };
  return (
    <View style={{ gap: space.xs }}>
      {target && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Target size={18} color={colors.accent} strokeWidth={1.75} aria-hidden />
          <Text style={text}>
            {targetText(t, target)}
            {target.kind === 'meeting' && target.title ? <Text style={{ color: colors.textMuted }}>{` · ${target.title}`}</Text> : null}
          </Text>
        </View>
      )}
      {rabbitPages !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <RabbitMark size={18} />
          <Text style={[text, rabbitPages < 0 ? { color: colors.text } : null]}>{rabbitText(t, rabbitPages)}</Text>
        </View>
      )}
    </View>
  );
}
