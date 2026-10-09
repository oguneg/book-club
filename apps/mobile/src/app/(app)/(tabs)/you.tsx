import { Link } from 'expo-router';
import { CircleHelp, FileText, Flag, LogOut, Settings, Shield } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useIsModerator } from '@/api/admin';
import { useReadings } from '@/api/readings';
import { authClient } from '@/auth/client';
import { BookCover } from '@/components/BookCover';
import { PageTitle } from '@/components/PageTitle';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { NavRow } from '@/components/ui/NavRow';
import { TextLink } from '@/components/ui/TextLink';
import { useTheme } from '@/theme';

/** You: the books you've read, your account, help, sign out. */
export default function YouTab() {
  const { t } = useTranslation();
  const { colors, fonts, fontSize, space } = useTheme();
  const { data: session } = authClient.useSession();
  const readings = useReadings();
  const moderator = useIsModerator();
  const done = (readings.data ?? []).filter((r) => r.status !== 'reading');
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

      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text accessibilityRole="header" aria-level={2} style={{ fontFamily: fonts.heading, fontSize: fontSize.lg, color: colors.text }}>
            {t('you.books')}
          </Text>
          {done.length > 0 && <TextLink href="/shelf" label={t('you.seeAll')} />}
        </View>
        {done.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{t('reading.shelfEmpty')}</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {done.slice(0, 6).map((r) => (
              <Link key={r.id} href={{ pathname: '/readings/[id]', params: { id: r.id } }} aria-label={r.edition.title}>
                <BookCover cover={r.edition.cover} title={r.edition.title} size="md" />
              </Link>
            ))}
          </View>
        )}
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
