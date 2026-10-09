import { CircleHelp, FileText, Flag, LogOut, Settings, Shield } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useIsModerator } from '@/api/admin';
import { authClient } from '@/auth/client';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { NavRow } from '@/components/ui/NavRow';
import { useTheme } from '@/theme';

/** You: your account, help, sign out. (Your books have their own tab.) */
export default function YouTab() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const { data: session } = authClient.useSession();
  const moderator = useIsModerator();
  const user = session?.user;
  const initials = (user?.name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <Screen>
      <PageTitle title={t('tabs.you')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.xl }}>
        <View aria-hidden style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.onAccent, fontSize: fontSize.lg, fontWeight: '700' }}>{initials}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>
            {user?.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{user?.email}</Text>
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <NavRow href="/account" icon={Settings} title={t('you.account')} detail={t('you.accountDetail')} />
        {moderator && <NavRow href="/admin/reports" icon={Flag} title={t('admin.open')} />}
        <NavRow href="/help" icon={CircleHelp} title={t('legal.help')} />
        <NavRow href="/privacy" icon={Shield} title={t('legal.privacy')} />
        <NavRow href="/terms" icon={FileText} title={t('legal.terms')} />
      </View>
      <View style={{ marginTop: space.xl, alignSelf: 'flex-start' }}>
        <Button variant="secondary" label={t('account.signOut')} icon={<LogOut size={18} color={colors.text} />} onPress={() => void authClient.signOut()} />
      </View>
    </Screen>
  );
}
