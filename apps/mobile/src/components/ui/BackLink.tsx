import { Link, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme';

/** Back to the parent page, at the top of a sub-page (there is no native header on these screens). */
export function BackLink({ href, label }: { href: Href; label: string }) {
  const { colors, fontSize, space, minTouch } = useTheme();
  return (
    <Link href={href} style={{ minHeight: minTouch, paddingVertical: space.md, alignSelf: 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
          <Path d="M8.5 2.5 4 7l4.5 4.5" stroke={colors.accent} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
        <Text style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '600' }}>{label}</Text>
      </View>
    </Link>
  );
}
