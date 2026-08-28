import { format } from 'date-fns';
import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppointmentCard } from '@/components/barber/AppointmentCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTodayAppointments, useUpdateAppointmentStatus } from '@/hooks/useBarberDashboard';
import type { AppointmentSummary } from '@/lib/types';
import { listFromResponse } from '@/lib/types';
import { openNavigation } from '@/lib/maps';
import { colors, spacing, typography } from '@/theme';

const nextStatus = (appointment: AppointmentSummary): string | null => {
  if (appointment.status === 'PENDING') return 'CONFIRMED';
  if (appointment.status === 'CONFIRMED')
    return appointment.isMobileService === true ? 'ON_THE_WAY' : 'IN_PROGRESS';
  if (appointment.status === 'ON_THE_WAY') return 'ARRIVED';
  if (appointment.status === 'ARRIVED') return 'IN_PROGRESS';
  if (appointment.status === 'IN_PROGRESS') return 'COMPLETED';
  return null;
};

export default function TodayScreen(): React.ReactElement {
  const appointments = useTodayAppointments();
  const updateStatus = useUpdateAppointmentStatus();
  const list = listFromResponse(appointments.data ?? {});
  const pending = list.filter((item) => item.status === 'PENDING').length;
  const revenue = list.reduce(
    (sum, item) => sum + (item.paymentStatus === 'SUCCEEDED' ? item.price : 0),
    0,
  );
  const confirmChange = (id: string, status: string, title: string): void => {
    Alert.alert(title, 'The customer will see this update immediately.', [
      { text: 'Go back', style: 'cancel' },
      {
        text: title,
        style: status === 'CANCELLED' ? 'destructive' : 'default',
        onPress: (): void => void updateStatus.mutateAsync({ id, status }),
      },
    ]);
  };

  return (
    <Screen
      refreshing={appointments.isFetching}
      onRefresh={() => {
        void appointments.refetch();
      }}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CUTG · PROFESSIONAL</Text>
        <ScreenHeader
          title="Your chair, at a glance."
          subtitle={format(new Date(), 'EEEE, MMMM d')}
        />
        <View style={styles.openStatus}>
          <View style={styles.statusDot} />
          <Text style={styles.openStatusText}>Workspace is ready</Text>
          <Ionicons color={colors.textMuted} name="arrow-forward" size={16} />
        </View>
      </View>
      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statIndex}>01</Text>
          <Text style={styles.statValue}>{list.length}</Text>
          <Text style={styles.statLabel}>Appointments</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statIndex}>02</Text>
          <Text style={styles.statValue}>{pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statIndex}>03</Text>
          <Text style={styles.statValue}>{'$' + revenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </Card>
      </View>
      {list.length === 0 && !appointments.isLoading ? (
        <EmptyState
          title="No appointments today"
          message="New bookings will appear here automatically."
        />
      ) : null}
      {list.map((appointment) => {
        const status = nextStatus(appointment);
        return (
          <View key={appointment.id} style={styles.item}>
            <AppointmentCard
              appointment={appointment}
              mode="barber"
              onPrimaryAction={
                appointment.isMobileService === true && appointment.serviceAddress !== null
                  ? (): void =>
                      void openNavigation(
                        appointment.serviceAddress?.latitude ?? 0,
                        appointment.serviceAddress?.longitude ?? 0,
                        appointment.serviceAddress?.addressLine1,
                      )
                  : undefined
              }
            />
            {status !== null ? (
              <Button
                title={
                  status === 'CONFIRMED'
                    ? 'Confirm'
                    : status === 'ON_THE_WAY'
                      ? 'Open journey'
                      : status === 'ARRIVED'
                        ? "I've arrived"
                        : status === 'IN_PROGRESS'
                          ? 'Start'
                          : 'Complete'
                }
                onPress={() => {
                  if (status === 'ON_THE_WAY') {
                    router.push('/(barber)/appointments/' + appointment.id);
                    return;
                  }
                  if (status === 'COMPLETED') {
                    confirmChange(appointment.id, status, 'Complete appointment');
                  } else {
                    void updateStatus.mutateAsync({ id: appointment.id, status });
                  }
                }}
              />
            ) : null}
            {appointment.status === 'PENDING' ? (
              <Button
                title="Decline"
                variant="danger"
                onPress={() => {
                  confirmChange(appointment.id, 'CANCELLED', 'Decline request');
                }}
              />
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  hero: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  item: {
    gap: spacing.sm,
  },
  openStatus: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  openStatusText: {
    ...typography.label,
    color: colors.textSecondary,
    flex: 1,
  },
  stat: {
    flex: 1,
    minHeight: 132,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  statIndex: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusDot: {
    backgroundColor: colors.textPrimary,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
});
