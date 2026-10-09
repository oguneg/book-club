import { Link, type Href } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** A tappable row in a list: an icon or picture, a title and a line under it, and a chevron. */
export function NavRow({
  href,
  icon: Icon,
  leading,
  title,
  detail,
}: {
  href: Href;
  icon?: LucideIcon;
  leading?: ReactNode;
  title: string;
  detail?: string | null;
}) {
  const { colors, fonts, fontSize, radius, space, minTouch } = useTheme();
  const [highlighted, setHighlighted] = useState(false);
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={detail ? `${title}, ${detail}` : title}
        onHoverIn={() => setHighlighted(true)}
        onHoverOut={() => setHighlighted(false)}
        onPressIn={() => setHighlighted(true)}
        onPressOut={() => setHighlighted(false)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          minHeight: minTouch + 8,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          borderRadius: radius.md,
          backgroundColor: highlighted ? colors.background : colors.surface,
        }}
      >
        {leading ?? (Icon ? <Icon size={20} color={colors.textMuted} strokeWidth={1.75} /> : null)}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: leading ? fonts.heading : undefined, fontSize: fontSize.md, fontWeight: leading ? undefined : '600', color: colors.text }}>{title}</Text>
          {detail ? (
            <Text numberOfLines={2} style={{ fontSize: fontSize.sm, color: colors.textMuted }}>
              {detail}
            </Text>
          ) : null}
        </View>
        <ChevronRight size={18} color={colors.textMuted} strokeWidth={1.75} />
      </Pressable>
    </Link>
  );
}
