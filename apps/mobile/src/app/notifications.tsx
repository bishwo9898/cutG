import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing, typography } from '@/theme';

export default function NotificationInboxScreen(): React.ReactElement {
  const inbox = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const user = useAuthStore((state) => state.user);

  const open = async (id: string, appointmentId?: string): Promise<void> => {
    await markRead.mutateAsync(id).catch(() => undefined);
    if (appointmentId === undefined) return;
    router.push(
      user?.userType === 'BARBER'
        ? `/(barber)/appointments/${appointmentId}`
        : `/(client)/appointments/${appointmentId}`,
    );
  };

  return (
    <Screen refreshing={inbox.isFetching} onRefresh={() => void inbox.refetch()}>
      <ScreenHeader
        showBack
        title="Notifications"
        subtitle="Booking and journey updates in one place."
      />
      {(inbox.data?.unreadCount ?? 0) > 0 ? (
        <Button
          title="Mark all as read"
          variant="secondary"
          onPress={() => void markAll.mutateAsync()}
        />
      ) : null}
      {inbox.data?.notifications.length === 0 ? (
        <EmptyState title="You’re all caught up" message="New booking updates will appear here." />
      ) : null}
      {inbox.data?.notifications.map((item) => (
        <Pressable
          accessibilityRole="button"
          key={item.id}
          onPress={() => void open(item.id, item.relatedData.appointmentId)}
          style={({ pressed }) => [
            styles.item,
            !item.isRead && styles.unread,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.icon, !item.isRead && styles.iconUnread]}>
            <Ionicons color={colors.textPrimary} name="notifications-outline" size={20} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.time}>
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </Text>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: spacing.xs },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconUnread: { backgroundColor: colors.statusPendingSurface },
  item: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  message: { ...typography.bodySmall, color: colors.textSecondary },
  pressed: { backgroundColor: '#F1ECE5', transform: [{ scale: 0.995 }] },
  time: { ...typography.caption, color: colors.textSecondary },
  title: { ...typography.label, color: colors.textPrimary },
  unread: { borderColor: colors.gold },
});
