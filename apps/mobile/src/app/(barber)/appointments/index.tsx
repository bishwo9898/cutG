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

const statuses = [
  { value: 'All', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'ON_THE_WAY', label: 'On the way' },
  { value: 'ARRIVED', label: 'Arrived' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

export default function BarberAppointmentListScreen(): React.ReactElement {
  const [status, setStatus] = useState<(typeof statuses)[number]['value']>('All');
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
      <ScreenHeader
        title="Appointments"
        subtitle="Review every customer booking and its progress."
      />
      <Input label="Search customer" value={search} onChangeText={setSearch} />
      <View style={styles.chips}>
        {statuses.map((item) => (
          <Button
            key={item.value}
            title={item.label}
            onPress={() => setStatus(item.value)}
            variant={item.value === status ? 'primary' : 'secondary'}
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
