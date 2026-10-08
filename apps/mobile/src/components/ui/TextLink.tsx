import { Link, type Href } from 'expo-router';
import { useTheme } from '@/theme';

export function TextLink({ href, label }: { href: Href; label: string }) {
  const { colors, fontSize, space } = useTheme();
  return (
    <Link
      href={href}
      style={{ color: colors.accent, fontSize: fontSize.sm, fontWeight: '600', paddingVertical: space.sm }}
    >
      {label}
    </Link>
  );
}
