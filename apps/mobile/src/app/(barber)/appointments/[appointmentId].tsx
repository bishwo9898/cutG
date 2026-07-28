import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useBarberAppointments, useUpdateAppointmentStatus } from '@/hooks/useBarberDashboard';
import { useLocationBroadcast } from '@/hooks/useLocationBroadcast';
import { errorMessage } from '@/lib/errors';
import { openNavigation } from '@/lib/maps';
import { colors, spacing, typography } from '@/theme';

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
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const appointment =
    appointments.data === undefined
      ? undefined
      : (appointments.data.appointments ?? appointments.data.data ?? []).find(
          (item) => item.id === appointmentId,
        );
  const status = nextStatus(appointment?.status, appointment?.isMobileService === true);
  const locationBroadcast = useLocationBroadcast(appointmentId, appointment?.status);

  const applyNextStatus = async (): Promise<void> => {
    if (appointment === undefined || status === null) return;
    setJourneyError(null);
    try {
      if (status.status === 'ON_THE_WAY') {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setJourneyError(
            'Journey not started. Allow precise location so the client can see the live trip.',
          );
          return;
        }
        await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      }
      await updateStatus.mutateAsync({
        id: appointment.id,
        status: status.status,
        notes: notes || undefined,
      });
    } catch (error) {
      setJourneyError(errorMessage(error));
    }
  };

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
          {appointment.status === 'ON_THE_WAY' ? (
            <Card>
              <View style={styles.trackingRow}>
                <View
                  style={[
                    styles.trackingDot,
                    locationBroadcast.state === 'active'
                      ? styles.trackingDotActive
                      : styles.trackingDotWarning,
                  ]}
                />
                <Text style={styles.title}>
                  {locationBroadcast.state === 'active'
                    ? 'Live trip connected'
                    : 'Connecting live trip'}
                </Text>
              </View>
              <Text style={styles.meta}>{locationBroadcast.message}</Text>
              {locationBroadcast.lastPingAt !== null ? (
                <Text style={styles.meta}>
                  Last sent {new Date(locationBroadcast.lastPingAt).toLocaleTimeString()}
                </Text>
              ) : null}
              <Text style={styles.trackingHelp}>
                Keep cutG open during this foreground test so the client continues receiving your
                position.
              </Text>
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
          {appointment.barberNotes !== null && appointment.barberNotes !== undefined ? (
            <Text style={styles.meta}>Saved note: {appointment.barberNotes}</Text>
          ) : null}
          {appointment.styleReference != null ? (
            <Card>
              <Text style={styles.title}>Client's requested style</Text>
              <Text style={styles.meta}>{appointment.styleReference.styleName}</Text>
              <Text style={styles.meta}>
                {appointment.styleReference.description ?? 'No extra style notes.'}
              </Text>
            </Card>
          ) : null}
          {status !== null ? (
            <Button
              disabled={updateStatus.isPending}
              title={status.label}
              onPress={() => {
                void applyNextStatus();
              }}
            />
          ) : null}
          {journeyError !== null ? <Text style={styles.error}>{journeyError}</Text> : null}
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
  error: {
    ...typography.bodySmall,
    color: colors.error,
  },
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
  trackingDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  trackingDotActive: {
    backgroundColor: colors.success,
  },
  trackingDotWarning: {
    backgroundColor: colors.warning,
  },
  trackingHelp: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.md,
  },
  trackingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
