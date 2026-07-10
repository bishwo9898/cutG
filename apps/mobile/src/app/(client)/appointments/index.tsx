import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppointmentCard } from '@/components/barber/AppointmentCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useClientAppointments } from '@/hooks/useAppointments';
import { listFromResponse } from '@/lib/types';
import { spacing } from '@/theme';

export default function AppointmentsScreen(): React.ReactElement {
  const [mode, setMode] = useState<'upcoming' | 'past'>('upcoming');
  const appointments = useClientAppointments(
    mode === 'upcoming' ? { upcoming: true } : { past: true },
  );
  const list = listFromResponse(appointments.data ?? {});

  return (
    <Screen
      refreshing={appointments.isFetching}
      onRefresh={() => {
        void appointments.refetch();
      }}
    >
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
      {list.length === 0 && !appointments.isLoading ? (
        <EmptyState title="No appointments" message="Book a barber from Discover to get started." />
      ) : null}
      {list.map((appointment) => (
        <AppointmentCard appointment={appointment} key={appointment.id} mode="client" />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
