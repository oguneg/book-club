import { CircleHelp, FileText, Flag, LogOut, Settings, Shield } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useIsModerator } from '@/api/admin';
import { authClient } from '@/auth/client';
import { Avatar } from '@/components/Avatar';
import { PageTitle } from '@/components/PageTitle';
import { ReadingStats } from '@/components/ReadingStats';
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

  return (
    <Screen>
      <PageTitle title={t('tabs.you')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, marginBottom: space.xl }}>
        <Avatar id={user?.id ?? ''} name={user?.name ?? ''} image={user?.image} me size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.headingBold, fontSize: fontSize.xl, color: colors.text }}>
            {user?.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{user?.email}</Text>
        </View>
      </View>

      <View style={{ gap: space.md, marginBottom: space.xl }}>
        <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
          {t('stats.title')}
        </Text>
        <ReadingStats />
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
