import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useChangeAppearance } from '@/api/preferences';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Hint } from '@/components/ui/Section';
import { Segmented } from '@/components/ui/Segmented';
import { loadStyleFonts, STYLE_NAMES, themeFor, useAppearance, useTheme, type Mode, type StyleName, type Theme } from '@/theme';

/**
 * How the app looks on this device: one of three styles (each a whole look: colours, type, corners), and
 * light, dark or the system's. Each choice is drawn in its own style, and picking one applies at once.
 */
export default function AppearancePage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, fonts, fontSize, space } = theme;
  const { appearance } = useAppearance();
  const setAppearance = useChangeAppearance();
  // So each card can show its own type, load every style's fonts while this page is open.
  const [, setFontsIn] = useState(0);
  useEffect(() => {
    let live = true;
    void Promise.all(STYLE_NAMES.map(loadStyleFonts)).then(() => {
      if (live) setFontsIn((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <Screen>
      <PageTitle title={t('appearance.title')} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xxl, color: colors.text, marginBottom: space.xl }}>
        {t('appearance.title')}
      </Text>

      <View style={{ gap: space.md }}>
        <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
          {t('appearance.style')}
        </Text>
        <View role="radiogroup" aria-label={t('appearance.style')} style={{ gap: space.md }}>
          {STYLE_NAMES.map((style) => (
            <StyleCard key={style} style={style} selected={appearance.style === style} onSelect={() => setAppearance({ style })} />
          ))}
        </View>
      </View>

      <View style={{ gap: space.md, marginTop: space.xl }}>
        <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
          {t('appearance.mode')}
        </Text>
        <Segmented<Mode>
          label={t('appearance.mode')}
          options={[
            { value: 'system', label: t('appearance.system') },
            { value: 'light', label: t('appearance.light') },
            { value: 'dark', label: t('appearance.dark') },
          ]}
          value={appearance.mode}
          onChange={(mode) => setAppearance({ mode })}
        />
        <Hint>{t('appearance.onDevice')}</Hint>
      </View>
    </Screen>
  );
}

/** One style, drawn in that style (in the light or dark you're in now), with its name and a line about it. */
function StyleCard({ style, selected, onSelect }: { style: StyleName; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const current = useTheme();
  const look: Theme = themeFor(style, current.scheme);
  const name = t(`appearance.styles.${style}.name`);
  const body = t(`appearance.styles.${style}.body`);
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      accessibilityLabel={`${name}. ${body}`}
      onPress={onSelect}
      style={({ pressed }) => ({
        borderRadius: current.radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? current.colors.accent : current.colors.control,
        padding: selected ? current.space.sm - 1 : current.space.sm,
        gap: current.space.sm,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Sample look={look} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: current.space.sm, paddingHorizontal: current.space.xs, paddingBottom: current.space.xs }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: current.colors.text, fontSize: current.fontSize.md, fontWeight: '700' }}>{name}</Text>
          <Text style={{ color: current.colors.textMuted, fontSize: current.fontSize.sm }}>{body}</Text>
        </View>
        {selected && (
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: current.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Check size={16} color={current.colors.onAccent} strokeWidth={2.5} aria-hidden />
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** A slice of the app in a style: a book you're reading, how far, and its one button. Decorative. */
function Sample({ look }: { look: Theme }) {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, radius, space } = look;
  return (
    <View aria-hidden style={{ backgroundColor: colors.background, borderRadius: radius.md, padding: space.md, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 40, height: 58, borderRadius: Math.min(radius.sm, 6), backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', boxShadow: colors.coverShadow }}>
          <Text style={{ color: colors.onAccent, fontFamily: fonts.headingBold, fontSize: 20 }}>H</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.headingBold, fontSize: fontSize.lg }}>{t('appearance.sample.title')}</Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('appearance.sample.where')}</Text>
          <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
            <View style={{ width: '59%', height: '100%', borderRadius: 3, backgroundColor: colors.accent }} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1, minHeight: 36, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.onAccent, fontSize: fontSize.sm, fontWeight: '700' }}>{t('appearance.sample.update')}</Text>
        </View>
        <View style={{ flex: 1, minHeight: 36, borderRadius: radius.md, borderWidth: 1, borderColor: colors.control, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '700' }}>{t('appearance.sample.note')}</Text>
        </View>
      </View>
    </View>
  );
}
