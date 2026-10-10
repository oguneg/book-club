import { Tabs } from 'expo-router';
import { BottomTabBar } from 'expo-router/js-tabs';
import { CircleUser, House, Library, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { SyncBar } from '@/components/SyncBar';
import { TabIcon } from '@/components/TabIcon';
import { useReducedMotion, useTheme } from '@/theme';

/**
 * Four places, always one tap away: what's happening, your books, your clubs, and you. Each tab keeps its
 * own history, so the bar (or the sidebar on a wide screen) stays put while you go deeper.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors, fontSize, layout, motion, style } = useTheme();
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const wide = width >= layout.wideFrom;
  const playful = style === 'playful';
  return (
    <Tabs
      // The tab bar is the app's main navigation; say so to screen readers.
      tabBar={(props) => (
        // In a row on wide screens, so the sidebar runs the full height. Progress waiting to sync shows
        // just above the tab bar, or at the foot of the sidebar.
        <View style={wide ? { flexDirection: 'row' } : undefined}>
          {!wide && <SyncBar />}
          <View role="navigation" aria-label={t('tabs.label')} style={wide ? { flexDirection: 'row' } : undefined}>
            <BottomTabBar {...props} />
          </View>
          {wide && <SyncBar placement="sidebar" />}
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
        // Switching tabs: the new one slides in a little from the side it's on as the old one fades, on the
        // style's spring (Playful's also grows into place). A plain crossfade with reduced motion.
        animation: 'shift',
        sceneStyleInterpolator: ({ current }) => ({
          sceneStyle: {
            // Fully opaque near rest, so Playful's overshoot doesn't flicker.
            opacity: current.progress.interpolate({ inputRange: [-1, -0.08, 0.08, 1], outputRange: [0, 1, 1, 0] }),
            transform: reduce
              ? []
              : [
                  { translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-motion.shift, 0, motion.shift] }) },
                  { scale: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: playful ? [0.97, 1, 0.97] : [1, 1, 1] }) },
                ],
          },
        }),
        transitionSpec: reduce ? { animation: 'timing', config: { duration: 150 } } : { animation: 'spring', config: motion.arrive },
      }}
    >
      <Tabs.Screen name="(activity)" options={{ title: t('tabs.home'), tabBarIcon: (p) => <TabIcon icon={House} {...p} /> }} />
      <Tabs.Screen name="(library)" options={{ title: t('tabs.books'), tabBarIcon: (p) => <TabIcon icon={Library} {...p} /> }} />
      <Tabs.Screen name="(clubs)" options={{ title: t('tabs.clubs'), tabBarIcon: (p) => <TabIcon icon={Users} {...p} /> }} />
      <Tabs.Screen name="(you)" options={{ title: t('tabs.you'), tabBarIcon: (p) => <TabIcon icon={CircleUser} {...p} /> }} />
    </Tabs>
  );
}
