import { Tabs } from 'expo-router';
import { BottomTabBar } from 'expo-router/js-tabs';
import { BookOpen, CircleUser, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { useTheme } from '@/theme';

/** Three places, always one tap away: the book you're reading, your clubs, and you. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, fontSize, layout } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideFrom;
  return (
    <Tabs
      // The tab bar is the app's main navigation; say so to screen readers.
      tabBar={(props) => (
        // In a row on wide screens, so the sidebar runs the full height.
        <View role="navigation" aria-label={t('tabs.label')} style={wide ? { flexDirection: 'row' } : undefined}>
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        // A sidebar on wide screens, a tab bar under your thumb on phones.
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: [
          { backgroundColor: colors.surface, borderTopColor: colors.border, borderRightColor: colors.border },
          // Wide: a slim sidebar (the default is a 360px drawer). Phone: room for the labels, which the
          // default line box clips.
          wide ? { width: 220, minWidth: 220 } : { height: 64, paddingTop: 4, paddingBottom: 4 },
        ],
        tabBarLabelStyle: { fontSize: fontSize.xs, lineHeight: 16, fontWeight: '600', flexShrink: 0 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.reading'), tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="clubs" options={{ title: t('tabs.clubs'), tabBarIcon: ({ color, size }) => <Users color={color} size={size} strokeWidth={1.75} /> }} />
      <Tabs.Screen name="you" options={{ title: t('tabs.you'), tabBarIcon: ({ color, size }) => <CircleUser color={color} size={size} strokeWidth={1.75} /> }} />
    </Tabs>
  );
}
