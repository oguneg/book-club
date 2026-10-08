import { Link, type Href } from 'expo-router';
import { useTheme } from '@/theme';

/** "← Back" at the top of a sub-page (there is no native header on these screens). */
export function BackLink({ href, label }: { href: Href; label: string }) {
  const { colors, fontSize, space, minTouch } = useTheme();
  return (
    <Link
      href={href}
      style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '600', minHeight: minTouch, paddingVertical: space.md, alignSelf: 'flex-start' }}
    >
      {`← ${label}`}
    </Link>
  );
}
