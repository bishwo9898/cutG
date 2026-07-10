import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import MapView from 'react-native-maps';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useBarberAppointments, useUpdateAppointmentStatus } from '@/hooks/useBarberDashboard';
import { colors, spacing, typography } from '@/theme';

const nextStatus = (status?: string): string | null => {
  if (status === 'PENDING') return 'CONFIRMED';
  if (status === 'CONFIRMED') return 'IN_PROGRESS';
  if (status === 'IN_PROGRESS') return 'COMPLETED';
  return null;
};

export default function BarberAppointmentDetailScreen(): React.ReactElement {
  const { appointmentId = '' } = useLocalSearchParams<{ appointmentId?: string }>();
  const appointments = useBarberAppointments({});
  const updateStatus = useUpdateAppointmentStatus();
  const [notes, setNotes] = useState('');
  const appointment =
    appointments.data === undefined
      ? undefined
      : (appointments.data.appointments ?? appointments.data.data ?? []).find(
          (item) => item.id === appointmentId,
        );
  const status = nextStatus(appointment?.status);

  return (
    <Screen
      refreshing={appointments.isFetching}
      onRefresh={() => {
        void appointments.refetch();
      }}
    >
      <ScreenHeader
        showBack
        title="Client detail"
        subtitle="Appointment status, notes, and payment."
      />
      {appointment !== undefined ? (
        <>
          <Card>
            <Text style={styles.title}>{appointment.clientName ?? 'Client'}</Text>
            <Text style={styles.meta}>{appointment.clientPhone ?? 'No phone on file'}</Text>
            <Badge label={appointment.status} tone={statusTone(appointment.status)} />
          </Card>
          <Card>
            <Text style={styles.title}>{appointment.serviceName}</Text>
            <Text style={styles.meta}>
              {appointment.scheduledDate} at {appointment.startTime}
            </Text>
            <Text style={styles.meta}>
              {'$' + appointment.price.toFixed(2)} · {appointment.paymentStatus}
            </Text>
          </Card>
          <Input label="Barber notes" value={notes} onChangeText={setNotes} multiline />
          {appointment.clientNotes !== null && appointment.clientNotes !== undefined ? (
            <Text style={styles.meta}>Client note: {appointment.clientNotes}</Text>
          ) : null}
          {status !== null ? (
            <Button
              title="Update status"
              onPress={() => {
                void updateStatus.mutateAsync({
                  id: appointment.id,
                  status,
                  notes: notes || undefined,
                });
              }}
            />
          ) : null}
          <MapView style={styles.map} />
        </>
      ) : (
        <Card>
          <Text style={styles.meta}>Appointment not found in the current list.</Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: {
    borderRadius: 8,
    height: 180,
    overflow: 'hidden',
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
});
