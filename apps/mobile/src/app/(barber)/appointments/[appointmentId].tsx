import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useBarberAppointments, useUpdateAppointmentStatus } from '@/hooks/useBarberDashboard';
import { colors, spacing, typography } from '@/theme';
import { openNavigation } from '@/lib/maps';

const nextStatus = (status?: string, mobile = false): { status: string; label: string } | null => {
  if (status === 'PENDING') return { status: 'CONFIRMED', label: 'Confirm appointment' };
  if (status === 'CONFIRMED')
    return mobile
      ? { status: 'ON_THE_WAY', label: 'Start journey' }
      : { status: 'IN_PROGRESS', label: 'Begin service' };
  if (status === 'ON_THE_WAY') return { status: 'ARRIVED', label: "I've arrived" };
  if (status === 'ARRIVED') return { status: 'IN_PROGRESS', label: 'Begin service' };
  if (status === 'IN_PROGRESS') return { status: 'COMPLETED', label: 'Complete service' };
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
  const status = nextStatus(appointment?.status, appointment?.isMobileService === true);

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
          {appointment.isMobileService === true && appointment.serviceAddress !== null ? (
            <Card>
              <Badge label="Mobile service" tone="info" />
              <Text style={styles.title}>{appointment.serviceAddress?.addressLine1}</Text>
              <Text style={styles.meta}>
                {appointment.serviceAddress?.city}, {appointment.serviceAddress?.state}{' '}
                {appointment.serviceAddress?.zipCode}
              </Text>
              <Text style={styles.meta}>
                {appointment.distanceMiles?.toFixed(1)} miles · about{' '}
                {appointment.estimatedTravelMinutes} min
              </Text>
              <Text style={styles.meta}>
                Travel fee: ${(appointment.travelFee ?? 0).toFixed(2)}
              </Text>
              <Button
                title="Navigate"
                variant="secondary"
                onPress={() =>
                  void openNavigation(
                    appointment.serviceAddress?.latitude ?? 0,
                    appointment.serviceAddress?.longitude ?? 0,
                    appointment.serviceAddress?.addressLine1,
                  )
                }
              />
            </Card>
          ) : null}
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
              title={status.label}
              onPress={() => {
                void updateStatus.mutateAsync({
                  id: appointment.id,
                  status: status.status,
                  notes: notes || undefined,
                });
              }}
            />
          ) : null}
          {appointment.isMobileService === true && appointment.serviceAddress !== null ? (
            <MapView
              style={styles.map}
              region={{
                latitude: appointment.serviceAddress?.latitude ?? 0,
                longitude: appointment.serviceAddress?.longitude ?? 0,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
            >
              <Marker
                coordinate={{
                  latitude: appointment.serviceAddress?.latitude ?? 0,
                  longitude: appointment.serviceAddress?.longitude ?? 0,
                }}
              />
            </MapView>
          ) : null}
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
