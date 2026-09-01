import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge, statusTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useBarberAppointment, useUpdateAppointmentStatus } from '@/hooks/useBarberDashboard';
import { useLocationBroadcast } from '@/hooks/useLocationBroadcast';
import { errorMessage } from '@/lib/errors';
import { openNavigation } from '@/lib/maps';
import {
  startBackgroundJourney,
  stopBackgroundLocationTracking,
} from '@/services/backgroundLocation';
import { queryClient } from '@/lib/queryClient';
import { colors, spacing, typography } from '@/theme';
import { humanLabel, money } from '@/lib/formatters';

const nextStatus = (status?: string, mobile = false): { status: string; label: string } | null => {
  if (status === 'PENDING') return { status: 'CONFIRMED', label: 'Confirm booking' };
  if (status === 'CONFIRMED')
    return mobile
      ? { status: 'ON_THE_WAY', label: 'Start journey' }
      : { status: 'IN_PROGRESS', label: 'Begin service' };
  if (status === 'ON_THE_WAY') return { status: 'ARRIVED', label: "I've arrived" };
  if (status === 'ARRIVED') return { status: 'IN_PROGRESS', label: 'Begin service' };
  if (status === 'IN_PROGRESS') return { status: 'COMPLETED', label: 'Complete appointment' };
  return null;
};

const explainBackgroundPermission = (): Promise<boolean> =>
  new Promise((resolve) => {
    Alert.alert(
      'Share your journey',
      'cutG needs precise background location only while you travel to this customer. Sharing stops as soon as you mark that you have arrived.',
      [
        {
          style: 'cancel',
          text: 'Not now',
          onPress: (): void => resolve(false),
        },
        { text: 'Continue', onPress: (): void => resolve(true) },
      ],
      { cancelable: true, onDismiss: (): void => resolve(false) },
    );
  });

type RouteCoordinate = { latitude: number; longitude: number };
type RouteAlternative = {
  distance?: unknown;
  geometry?: { coordinates?: unknown };
};

const shortestRouteCoordinates = (payload: unknown): RouteCoordinate[] => {
  if (payload === null || typeof payload !== 'object') return [];
  const routes = (payload as { routes?: RouteAlternative[] }).routes;
  if (!Array.isArray(routes)) return [];
  const selected = routes
    .filter(
      (route) =>
        typeof route.distance === 'number' &&
        Number.isFinite(route.distance) &&
        Array.isArray(route.geometry?.coordinates),
    )
    .sort((left, right) => Number(left.distance) - Number(right.distance))[0];
  if (!Array.isArray(selected?.geometry?.coordinates)) return [];
  return selected.geometry.coordinates.flatMap((point) =>
    Array.isArray(point) &&
    typeof point[0] === 'number' &&
    typeof point[1] === 'number' &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
      ? [{ latitude: point[1], longitude: point[0] }]
      : [],
  );
};

export default function BarberAppointmentDetailScreen(): React.ReactElement {
  const { appointmentId = '' } = useLocalSearchParams<{ appointmentId?: string }>();
  const appointment = useBarberAppointment(appointmentId);
  const updateStatus = useUpdateAppointmentStatus();
  const [notes, setNotes] = useState('');
  const [journeyError, setJourneyError] = useState<string | null>(null);
  const [startingJourney, setStartingJourney] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([]);
  const mapRef = useRef<MapView | null>(null);
  const item = appointment.data;
  const status = nextStatus(item?.status, item?.isMobileService === true);
  const locationBroadcast = useLocationBroadcast(appointmentId, item?.status);

  useEffect(() => {
    const origin = item?.journey.routeOrigin;
    const destination = item?.location;
    if (origin == null || destination?.latitude == null || destination.longitude == null) {
      setRouteCoordinates([]);
      return;
    }
    const controller = new AbortController();
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?alternatives=true&overview=full&geometries=geojson&steps=false`;
    void fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Route request failed with ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => setRouteCoordinates(shortestRouteCoordinates(payload)))
      .catch((error: unknown) => {
        if (!(error instanceof Error && error.name === 'AbortError')) setRouteCoordinates([]);
      });
    return (): void => controller.abort();
  }, [
    item?.journey.routeOrigin?.latitude,
    item?.journey.routeOrigin?.longitude,
    item?.location?.latitude,
    item?.location?.longitude,
  ]);

  useEffect(() => {
    if (routeCoordinates.length < 2) return;
    mapRef.current?.fitToCoordinates(routeCoordinates, {
      animated: true,
      edgePadding: { bottom: 36, left: 36, right: 36, top: 36 },
    });
  }, [routeCoordinates]);

  const startJourney = async (): Promise<void> => {
    if (item === undefined || !(await explainBackgroundPermission())) return;
    setStartingJourney(true);
    setJourneyError(null);
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (!foreground.granted) {
        setJourneyError('Journey not started. Precise location permission is required.');
        return;
      }
      const background = await Location.requestBackgroundPermissionsAsync();
      if (!background.granted) {
        setJourneyError(
          'Journey not started. Choose “Always allow” so sharing continues when cutG is minimized.',
        );
        return;
      }
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await startBackgroundJourney(item.id, initialLocation);
      await queryClient.invalidateQueries({ queryKey: ['barber', 'appointments'] });
      if (item.location?.latitude != null && item.location.longitude != null) {
        const destinationLabel =
          item.location.formattedAddress ??
          [
            item.location.addressLine1,
            item.location.city,
            item.location.state,
            item.location.zipCode,
          ]
            .filter(Boolean)
            .join(', ');
        await openNavigation(
          item.location.latitude,
          item.location.longitude,
          destinationLabel || 'Customer address',
        );
      }
    } catch (error) {
      setJourneyError(errorMessage(error));
    } finally {
      setStartingJourney(false);
    }
  };

  const applyNextStatus = async (): Promise<void> => {
    if (item === undefined || status === null) return;
    if (status.status === 'ON_THE_WAY') {
      await startJourney();
      return;
    }
    setJourneyError(null);
    try {
      await updateStatus.mutateAsync({
        id: item.id,
        status: status.status,
        notes: notes || undefined,
      });
      if (['ARRIVED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status.status)) {
        await stopBackgroundLocationTracking();
      }
    } catch (error) {
      setJourneyError(errorMessage(error));
    }
  };

  const confirmStatus = (next: string, title: string, description: string): void => {
    if (item === undefined) return;
    Alert.alert(title, description, [
      { text: 'Go back', style: 'cancel' },
      {
        text: title,
        style: 'destructive',
        onPress: (): void => {
          void updateStatus
            .mutateAsync({ id: item.id, status: next, notes: notes || undefined })
            .then(async () => {
              if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(next))
                await stopBackgroundLocationTracking();
            })
            .catch((error: unknown) => setJourneyError(errorMessage(error)));
        },
      },
    ]);
  };

  if (item === undefined) {
    return (
      <Screen refreshing={appointment.isFetching} onRefresh={() => void appointment.refetch()}>
        <ScreenHeader showBack title="Review booking" subtitle="Appointment details" />
        <Card>
          <Text style={styles.meta}>
            {appointment.isError ? errorMessage(appointment.error) : 'Loading appointment…'}
          </Text>
        </Card>
      </Screen>
    );
  }

  const location = item.location;
  const coordinates =
    location?.latitude != null && location.longitude != null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null;
  const styleImage = item.styleReference?.previewImageUrl ?? item.styleReference?.sourcePhotoUrl;
  const address =
    location?.formattedAddress ??
    [location?.addressLine1, location?.city, location?.state, location?.zipCode]
      .filter(Boolean)
      .join(', ');

  return (
    <Screen refreshing={appointment.isFetching} onRefresh={() => void appointment.refetch()}>
      <ScreenHeader
        showBack
        title="Review booking"
        subtitle="Customer, service, pricing, location, and progress."
      />

      <Card>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>CUSTOMER</Text>
            <Text style={styles.heroTitle}>
              {item.client.firstName} {item.client.lastName}
            </Text>
          </View>
          <Badge label={humanLabel(item.status)} tone={statusTone(item.status)} />
        </View>
        {item.client.phone !== null ? (
          <Text
            style={styles.link}
            onPress={() => void Linking.openURL(`tel:${item.client.phone}`)}
          >
            {item.client.phone}
          </Text>
        ) : (
          <Text style={styles.meta}>No phone number on file.</Text>
        )}
        <Text
          style={styles.link}
          onPress={() => void Linking.openURL(`mailto:${item.client.email}`)}
        >
          {item.client.email}
        </Text>
      </Card>

      <Card>
        <View style={styles.titleRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>SERVICE</Text>
            <Text style={styles.title}>{item.service.name}</Text>
          </View>
          <Text style={styles.total}>{money(item.pricing.total)}</Text>
        </View>
        <View style={styles.factGrid}>
          <Text style={styles.meta}>
            {new Date(item.scheduledAt).toLocaleDateString()} at{' '}
            {new Date(item.scheduledAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
          <Text style={styles.meta}>{item.durationMinutes} minutes</Text>
          <Text style={styles.meta}>
            {item.isMobileService ? 'Mobile service' : 'Shop service'}
          </Text>
          <Text style={styles.meta}>
            {humanLabel(item.paymentMethod)} · {humanLabel(item.paymentStatus)}
          </Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.eyebrow}>PROGRESS</Text>
        <Text style={styles.title}>Appointment timeline</Text>
        <View style={styles.timeline}>
          {item.timeline.map((entry) => (
            <View key={entry.status} style={styles.timelineRow}>
              <View
                style={[
                  styles.timelineDot,
                  (entry.done || entry.current) && styles.timelineDotDone,
                ]}
              >
                <Ionicons
                  color={entry.done || entry.current ? colors.textOnAccent : colors.textMuted}
                  name={entry.done ? 'checkmark' : entry.current ? 'ellipse' : 'ellipse-outline'}
                  size={11}
                />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.meta, entry.current && styles.timelineCurrent]}>
                  {entry.label}
                </Text>
                {entry.at !== null ? (
                  <Text style={styles.timelineTime}>{new Date(entry.at).toLocaleString()}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </Card>

      {location !== null ? (
        <Card>
          <Text style={styles.eyebrow}>LOCATION</Text>
          <Text style={styles.title}>{address || 'Saved appointment location'}</Text>
          {item.isMobileService ? (
            <View style={styles.chips}>
              {item.distanceMiles !== null ? (
                <Text style={styles.chip}>{item.distanceMiles.toFixed(1)} miles</Text>
              ) : null}
              {item.estimatedTravelMinutes !== null ? (
                <Text style={styles.chip}>{item.estimatedTravelMinutes} min travel</Text>
              ) : null}
              <Text style={styles.chip}>${item.pricing.travelFee.toFixed(2)} travel</Text>
            </View>
          ) : null}
          {coordinates !== null ? (
            <>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: coordinates.latitude,
                  longitude: coordinates.longitude,
                  latitudeDelta: 0.06,
                  longitudeDelta: 0.06,
                }}
              >
                {item.journey.routeOrigin != null ? (
                  <Marker coordinate={item.journey.routeOrigin} pinColor={colors.statusOnTheWay} />
                ) : null}
                <Marker coordinate={coordinates} pinColor={colors.statusArrived} />
                {routeCoordinates.length >= 2 ? (
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeColor={colors.statusOnTheWay}
                    strokeWidth={5}
                  />
                ) : null}
              </MapView>
              {routeCoordinates.length >= 2 ? (
                <Text style={styles.meta}>Shortest available driving route shown.</Text>
              ) : null}
              <Button
                title="Open directions"
                variant="secondary"
                onPress={() =>
                  void openNavigation(coordinates.latitude, coordinates.longitude, address)
                }
              />
            </>
          ) : (
            <Text style={styles.warning}>Map coordinates are unavailable for this booking.</Text>
          )}
        </Card>
      ) : null}

      {item.status === 'ON_THE_WAY' ? (
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
                ? 'Background trip connected'
                : 'Location needs attention'}
            </Text>
          </View>
          <Text style={styles.meta}>{locationBroadcast.message}</Text>
          {locationBroadcast.lastPingAt !== null ? (
            <Text style={styles.meta}>
              Last sent {new Date(locationBroadcast.lastPingAt).toLocaleTimeString()}
            </Text>
          ) : null}
          <Text style={styles.trackingHelp}>
            You may minimize cutG or lock your phone. Sharing stops when you mark arrival.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.title}>Price breakdown</Text>
        <View style={styles.priceRow}>
          <Text style={styles.meta}>Service</Text>
          <Text style={styles.price}>${item.pricing.serviceFee.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.meta}>Travel</Text>
          <Text style={styles.price}>${item.pricing.travelFee.toFixed(2)}</Text>
        </View>
        <View style={[styles.priceRow, styles.priceTotal]}>
          <Text style={styles.title}>Total</Text>
          <Text style={styles.total}>${item.pricing.total.toFixed(2)}</Text>
        </View>
      </Card>

      <Card>
        <Text style={styles.title}>Style and notes</Text>
        <Text style={styles.label}>CUSTOMER NOTE</Text>
        <Text style={styles.meta}>{item.clientNotes ?? 'No customer note was added.'}</Text>
        <Text style={styles.label}>SAVED BARBER NOTE</Text>
        <Text style={styles.meta}>{item.barberNotes ?? 'No barber note has been saved.'}</Text>
        {item.styleReference !== null ? (
          <View style={styles.styleRow}>
            {styleImage != null ? (
              <Image source={{ uri: styleImage }} style={styles.styleImage} />
            ) : null}
            <View style={styles.flex}>
              <Text style={styles.label}>REQUESTED STYLE</Text>
              <Text style={styles.title}>{item.styleReference.styleName ?? 'Style reference'}</Text>
              <Text style={styles.meta}>
                {item.styleReference.description ?? 'No additional style description.'}
              </Text>
            </View>
          </View>
        ) : item.styleNotes !== null ? (
          <Text style={styles.meta}>{item.styleNotes}</Text>
        ) : null}
      </Card>

      <Input
        label="Update barber notes with next action"
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      {status !== null ? (
        <Button
          disabled={updateStatus.isPending || startingJourney}
          title={startingJourney ? 'Starting secure location…' : status.label}
          onPress={() =>
            status.status === 'COMPLETED'
              ? confirmStatus(
                  'COMPLETED',
                  'Complete appointment',
                  'This closes the booking and cannot be undone.',
                )
              : void applyNextStatus()
          }
        />
      ) : null}
      {item.status === 'PENDING' ? (
        <Button
          title="Decline request"
          variant="danger"
          onPress={() =>
            confirmStatus(
              'CANCELLED',
              'Decline request',
              'The customer will be notified and this time will reopen.',
            )
          }
        />
      ) : null}
      {item.status === 'CONFIRMED' ? (
        <View style={styles.dangerActions}>
          <View style={styles.flex}>
            <Button
              title="Cancel booking"
              variant="danger"
              onPress={() =>
                confirmStatus(
                  'CANCELLED',
                  'Cancel booking',
                  'The customer will be notified and this time will reopen.',
                )
              }
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Mark no-show"
              variant="secondary"
              onPress={() =>
                confirmStatus(
                  'NO_SHOW',
                  'Mark no-show',
                  'Use this only when the customer did not attend.',
                )
              }
            />
          </View>
        </View>
      ) : null}
      {journeyError !== null ? <Text style={styles.error}>{journeyError}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: {
    ...typography.caption,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderLight,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.textPrimary,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  dangerActions: { flexDirection: 'row', gap: spacing.sm },
  error: { ...typography.bodySmall, color: colors.statusCancelled },
  eyebrow: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  factGrid: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  flex: { flex: 1 },
  heroTitle: { ...typography.h2, color: colors.textPrimary },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '800',
    marginTop: spacing.lg,
  },
  link: {
    ...typography.body,
    color: colors.statusOnTheWay,
    marginTop: spacing.sm,
    textDecorationLine: 'underline',
  },
  map: { borderRadius: 12, height: 220, marginVertical: spacing.md, overflow: 'hidden' },
  meta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  price: { ...typography.label, color: colors.textPrimary },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  priceTotal: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  styleImage: { borderRadius: 10, height: 92, width: 92 },
  styleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  timeline: { gap: spacing.sm, marginTop: spacing.md },
  timelineCurrent: { color: colors.textPrimary, fontWeight: '800' },
  timelineDot: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  timelineDotDone: { backgroundColor: colors.statusConfirmed, borderColor: colors.statusConfirmed },
  timelineRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  timelineTime: { ...typography.caption, color: colors.textSecondary },
  total: { ...typography.h2, color: colors.textPrimary },
  trackingDot: { borderRadius: 999, height: 10, width: 10 },
  trackingDotActive: { backgroundColor: colors.statusConfirmed },
  trackingDotWarning: { backgroundColor: colors.statusPending },
  trackingHelp: { ...typography.caption, color: colors.statusOnTheWay, marginTop: spacing.md },
  trackingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  warning: { ...typography.bodySmall, color: colors.statusPending, marginTop: spacing.md },
});
