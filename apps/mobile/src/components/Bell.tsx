import { router } from 'expo-router';
import { Bell as BellIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useUnreadCount } from '@/api/notifications';
import { useTheme } from '@/theme';

/** The bell: your notifications, with how many are new on a small bookcloth badge. */
export function Bell() {
  const { t } = useTranslation();
  const { colors, minTouch } = useTheme();
  const unread = useUnreadCount();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? t('notifications.openWithUnread', { count: unread }) : t('notifications.title')}
      onPress={() => router.push('/notifications')}
      style={({ pressed }) => ({ width: minTouch, height: minTouch, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <BellIcon size={24} color={colors.text} strokeWidth={1.75} />
      {unread > 0 && (
        <View
          aria-hidden
          style={{
            position: 'absolute',
            top: 6,
            right: 4,
            minWidth: 20,
            height: 20,
            paddingHorizontal: 4,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: colors.background,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.onAccent, fontSize: 10, lineHeight: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}
