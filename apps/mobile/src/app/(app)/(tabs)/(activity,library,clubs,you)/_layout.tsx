import { Stack } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/ui/IconButton';
import { useTheme } from '@/theme';

// Each tab keeps its own history: a book or a club opened from a tab stays in that tab, under the tab bar,
// with a back arrow. A cold link (reload, shared URL) opens shared screens in the first group, Home.
export const unstable_settings = {
  anchor: 'index',
  activity: { anchor: 'index' },
  library: { anchor: 'library' },
  clubs: { anchor: 'clubs' },
  you: { anchor: 'you' },
};

/** The tabs' own first screens carry their title in the page; everything opened from them gets a header. */
const ROOTS = new Set(['index', 'library', 'clubs', 'you']);

export default function TabStack() {
  const { t } = useTranslation();
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Stack
      screenOptions={({ route }) => ({
        headerShown: !ROOTS.has(route.name),
        // A quiet bar on the page colour: the way back on the left, the page's rare actions (⋯) on the
        // right, and no title, since every page has its own heading.
        header: ({ navigation, options, back }) => (
          <View
            role="banner"
            style={{
              paddingTop: insets.top,
              paddingHorizontal: space.sm,
              minHeight: insets.top + 52,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.background,
            }}
          >
            {back ? <IconButton icon={ArrowLeft} label={t('common.back')} tone="accent" onPress={() => navigation.goBack()} /> : <View />}
            {options.headerRight?.({ tintColor: colors.accent, canGoBack: Boolean(back) })}
          </View>
        ),
        contentStyle: { backgroundColor: colors.background },
      })}
    />
  );
}
