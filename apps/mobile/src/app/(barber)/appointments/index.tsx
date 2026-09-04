import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppointmentCard } from '@/components/barber/AppointmentCard';
import { PagedList } from '@/components/layout/PagedList';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { usePagedBarberAppointments } from '@/hooks/useBarberDashboard';
import type { AppointmentSummary } from '@/lib/types';
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
  // The search runs on the server, so hold off until the barber stops typing rather than firing
  // a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return (): void => clearTimeout(timer);
  }, [search]);

  const filters = useMemo(
    () => ({
      ...(status === 'All' ? {} : { status }),
      ...(debouncedSearch.length === 0 ? {} : { search: debouncedSearch }),
    }),
    [status, debouncedSearch],
  );
  const appointments = usePagedBarberAppointments(filters);

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title="Appointments"
        subtitle="Review every customer booking and its progress."
      />
      <Input
        label="Search customer"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        placeholder="Name"
      />
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
    </View>
  );

  return (
    <PagedList<AppointmentSummary>
      query={appointments}
      header={header}
      keyExtractor={(appointment) => appointment.id}
      renderItem={(appointment) => <AppointmentCard appointment={appointment} mode="barber" />}
      emptyIcon="calendar-outline"
      emptyTitle={debouncedSearch.length > 0 ? 'No customer by that name' : 'No appointments'}
      emptyMessage={
        debouncedSearch.length > 0
          ? 'Check the spelling, or clear the search to see every booking.'
          : 'Bookings matching this filter will appear here.'
      }
    />
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
});
