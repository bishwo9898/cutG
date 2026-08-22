import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/store/authStore';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showNotifications?: boolean;
};

export const ScreenHeader = ({
  title,
  subtitle,
  showBack = false,
  showNotifications = !showBack,
}: ScreenHeaderProps): React.ReactElement => (
  <HeaderContent
    title={title}
    subtitle={subtitle}
    showBack={showBack}
    showNotifications={showNotifications}
  />
);

const HeaderContent = ({
  title,
  subtitle,
  showBack,
  showNotifications,
}: Required<Pick<ScreenHeaderProps, 'title' | 'showBack' | 'showNotifications'>> &
  Pick<ScreenHeaderProps, 'subtitle'>): React.ReactElement => {
  const user = useAuthStore((state) => state.user);
  const notifications = useNotifications(1);
  const unread = notifications.data?.unreadCount ?? 0;
  return (
    <View style={styles.wrap}>
      {showBack ? (
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons color={colors.textPrimary} name="chevron-back" size={22} />
        </Pressable>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle !== undefined ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {showNotifications && user !== null ? (
        <Pressable
          accessibilityLabel={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
          accessibilityRole="button"
          onPress={() => router.push('/notifications')}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons color={colors.textPrimary} name="notifications-outline" size={21} />
          {unread > 0 ? (
            <View style={styles.count}>
              <Text style={styles.countText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  count: {
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    minWidth: 18,
    paddingHorizontal: 3,
  },
  countText: { color: colors.textOnAccent, fontSize: 10, fontWeight: '800' },
  pressed: { backgroundColor: '#F1ECE5' },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  wrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
});
