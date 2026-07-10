import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { AppointmentCard } from '@/components/barber/AppointmentCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTodayAppointments, useUpdateAppointmentStatus } from '@/hooks/useBarberDashboard';
import type { AppointmentSummary } from '@/lib/types';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const nextStatus = (appointment: AppointmentSummary): string | null => {
  if (appointment.status === 'PENDING') return 'CONFIRMED';
  if (appointment.status === 'CONFIRMED') return 'IN_PROGRESS';
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

  return (
    <Screen
      refreshing={appointments.isFetching}
      onRefresh={() => {
        void appointments.refetch();
      }}
    >
      <ScreenHeader title="Today" subtitle={format(new Date(), 'EEEE, MMMM d')} />
      <View style={styles.stats}>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{list.length}</Text>
          <Text style={styles.statLabel}>Appointments</Text>
        </Card>
        <Card style={styles.stat}>
          <Text style={styles.statValue}>{pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </Card>
        <Card style={styles.stat}>
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
            <AppointmentCard appointment={appointment} mode="barber" />
            {status !== null ? (
              <Button
                title={
                  status === 'CONFIRMED'
                    ? 'Confirm'
                    : status === 'IN_PROGRESS'
                      ? 'Start'
                      : 'Complete'
                }
                onPress={() => {
                  void updateStatus.mutateAsync({ id: appointment.id, status });
                }}
              />
            ) : null}
            {appointment.status === 'PENDING' ? (
              <Button
                title="Decline"
                variant="danger"
                onPress={() => {
                  void updateStatus.mutateAsync({ id: appointment.id, status: 'CANCELLED' });
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
  item: {
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
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
});
