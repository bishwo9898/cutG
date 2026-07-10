import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppointmentCard } from '@/components/barber/AppointmentCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { useBarberAppointments } from '@/hooks/useBarberDashboard';
import { listFromResponse } from '@/lib/types';
import { spacing } from '@/theme';

const statuses = ['All', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;

export default function BarberAppointmentListScreen(): React.ReactElement {
  const [status, setStatus] = useState<(typeof statuses)[number]>('All');
  const [search, setSearch] = useState('');
  const appointments = useBarberAppointments(status === 'All' ? {} : { status });
  const list = listFromResponse(appointments.data ?? {}).filter((appointment) =>
    (appointment.clientName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Screen
      refreshing={appointments.isFetching}
      onRefresh={() => {
        void appointments.refetch();
      }}
    >
      <ScreenHeader title="Clients" subtitle="All appointment activity." />
      <Input label="Search client" value={search} onChangeText={setSearch} />
      <View style={styles.chips}>
        {statuses.map((item) => (
          <Button
            key={item}
            title={item}
            onPress={() => setStatus(item)}
            variant={item === status ? 'primary' : 'secondary'}
          />
        ))}
      </View>
      {list.length === 0 && !appointments.isLoading ? (
        <EmptyState title="No appointments" message="Try another filter." />
      ) : null}
      {list.map((appointment) => (
        <AppointmentCard appointment={appointment} key={appointment.id} mode="barber" />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
