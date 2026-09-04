import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppointmentCard } from '@/components/barber/AppointmentCard';
import { PagedList } from '@/components/layout/PagedList';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { usePagedClientAppointments } from '@/hooks/useAppointments';
import type { AppointmentSummary } from '@/lib/types';
import { spacing } from '@/theme';

export default function AppointmentsScreen(): React.ReactElement {
  const [mode, setMode] = useState<'upcoming' | 'past'>('upcoming');
  const filters = useMemo(
    () => (mode === 'upcoming' ? { upcoming: true } : { past: true }),
    [mode],
  );
  const appointments = usePagedClientAppointments(filters);

  const header = (
    <View style={styles.header}>
      <ScreenHeader title="Appointments" subtitle="Upcoming and past bookings." />
      <View style={styles.tabs}>
        <Button
          title="Upcoming"
          onPress={() => setMode('upcoming')}
          variant={mode === 'upcoming' ? 'primary' : 'secondary'}
        />
        <Button
          title="Past"
          onPress={() => setMode('past')}
          variant={mode === 'past' ? 'primary' : 'secondary'}
        />
      </View>
    </View>
  );

  return (
    <PagedList<AppointmentSummary>
      query={appointments}
      header={header}
      keyExtractor={(appointment) => appointment.id}
      renderItem={(appointment) => <AppointmentCard appointment={appointment} mode="client" />}
      emptyIcon="calendar-outline"
      emptyTitle={mode === 'upcoming' ? 'Nothing booked yet' : 'No past appointments'}
      emptyMessage={
        mode === 'upcoming'
          ? 'Find a barber from Discover to book your first cut.'
          : 'Appointments you have been to will be kept here.'
      }
    />
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
