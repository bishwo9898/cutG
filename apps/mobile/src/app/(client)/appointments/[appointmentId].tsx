import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge, statusTone } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { StarRating } from '@/components/ui/StarRating';
import {
  useCancelAppointment,
  useClientAppointment,
  useCreateReview,
} from '@/hooks/useAppointments';
import { useAppointmentStatus } from '@/hooks/useAppointmentStatus';
import { usePaymentStatus } from '@/hooks/usePayments';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

export default function ClientAppointmentDetailScreen(): React.ReactElement {
  const { appointmentId = '' } = useLocalSearchParams<{ appointmentId?: string }>();
  const appointment = useClientAppointment(appointmentId);
  const statusUpdates = useAppointmentStatus(appointmentId, appointment.data?.scheduledDate);
  const payment = usePaymentStatus(appointmentId);
  const cancelAppointment = useCancelAppointment();
  const review = useCreateReview();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { duration: 700, toValue: 1, useNativeDriver: true }),
        Animated.timing(pulse, { duration: 700, toValue: 0.35, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return (): void => animation.stop();
  }, [pulse]);

  const cancel = async (): Promise<void> => {
    try {
      await cancelAppointment.mutateAsync(appointmentId);
      setConfirmCancel(false);
      await appointment.refetch();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const submitReview = async (): Promise<void> => {
    try {
      await review.mutateAsync({ appointmentId, rating, comment: comment || undefined });
      setMessage('Review submitted.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const item = appointment.data;
  const timeline = statusUpdates.data;

  return (
    <Screen
      refreshing={appointment.isFetching}
      onRefresh={() => {
        void appointment.refetch();
      }}
    >
      <ScreenHeader showBack title="Appointment" subtitle="Booking details and actions." />
      {item !== undefined ? (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.title}>{item.serviceName}</Text>
              <Badge label={item.status} tone={statusTone(item.status)} />
            </View>
            <Text style={styles.meta}>
              {item.barberName ?? 'Barber'} · {item.scheduledDate} at {item.startTime}
            </Text>
            <Text style={styles.price}>{'$' + (item.pricing?.total ?? item.price).toFixed(2)}</Text>
          </Card>
          {item.isMobileService === true ? (
            <Card>
              <Badge label="Mobile service" tone="info" />
              <Text style={styles.title}>Your barber comes to you</Text>
              <Text style={styles.meta}>
                {item.serviceAddress?.addressLine1}, {item.serviceAddress?.city},{' '}
                {item.serviceAddress?.state}
              </Text>
              {timeline?.currentStatus === 'ON_THE_WAY' ? (
                <View style={styles.travelBanner}>
                  <Text style={styles.travelTitle}>Your barber is on the way</Text>
                  <Text style={styles.meta}>
                    {timeline.departedAt === null
                      ? 'Journey started'
                      : `Departed ${new Date(timeline.departedAt).toLocaleTimeString()}`}
                  </Text>
                  <Text style={styles.meta}>Estimated arrival around {item.startTime}</Text>
                </View>
              ) : null}
              {timeline?.currentStatus === 'ARRIVED' ? (
                <View style={styles.travelBanner}>
                  <Text style={styles.travelTitle}>Your barber has arrived</Text>
                  <Text style={styles.meta}>
                    {timeline.arrivedAt === null
                      ? 'Ready for your service'
                      : `Arrived ${new Date(timeline.arrivedAt).toLocaleTimeString()}`}
                  </Text>
                </View>
              ) : null}
              <View style={styles.timeline}>
                {(timeline?.timeline ?? []).map((entry) => (
                  <View key={entry.status} style={styles.timelineRow}>
                    {entry.active ? (
                      <Animated.Text
                        style={[styles.timelineMarker, styles.timelineReached, { opacity: pulse }]}
                      >
                        ●
                      </Animated.Text>
                    ) : (
                      <Text style={[styles.timelineMarker, entry.done && styles.timelineReached]}>
                        {entry.done ? '✓' : '○'}
                      </Text>
                    )}
                    <View style={styles.timelineCopy}>
                      <Text style={[styles.timelineItem, entry.active && styles.timelineActive]}>
                        {entry.label}
                      </Text>
                      {entry.at !== null ? (
                        <Text style={styles.timelineTime}>
                          {new Date(entry.at).toLocaleString()}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
              {item.serviceAddress?.latitude != null && item.serviceAddress.longitude != null ? (
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: item.serviceAddress.latitude,
                    longitude: item.serviceAddress.longitude,
                    latitudeDelta: 0.025,
                    longitudeDelta: 0.025,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: item.serviceAddress.latitude,
                      longitude: item.serviceAddress.longitude,
                    }}
                    title="Mobile appointment"
                  />
                </MapView>
              ) : null}
              <Text style={styles.meta}>
                Service: ${(item.pricing?.serviceFee ?? item.price).toFixed(2)}
              </Text>
              <Text style={styles.meta}>Travel fee: ${(item.travelFee ?? 0).toFixed(2)}</Text>
            </Card>
          ) : null}
          <Card>
            <Text style={styles.title}>Payment</Text>
            <Text style={styles.meta}>{payment.data?.paymentStatus ?? item.paymentStatus}</Text>
            {(payment.data?.paymentStatus ?? item.paymentStatus) === 'PENDING' ? (
              <Button
                title="Pay Now"
                onPress={() =>
                  router.push(
                    '/(client)/discover/' +
                      item.barberId +
                      '/book/payment?appointmentId=' +
                      appointmentId,
                  )
                }
              />
            ) : null}
          </Card>
          {item.status === 'PENDING' || item.status === 'CONFIRMED' ? (
            <Button
              title="Cancel appointment"
              variant="danger"
              onPress={() => setConfirmCancel(true)}
            />
          ) : null}
          {item.status === 'COMPLETED' && item.hasReview !== true ? (
            <Card>
              <Text style={styles.title}>Leave a review</Text>
              <StarRating value={rating} onChange={setRating} size={28} />
              <Input label="Comment" value={comment} onChangeText={setComment} multiline />
              <Button
                title="Submit Review"
                onPress={() => {
                  void submitReview();
                }}
              />
            </Card>
          ) : null}
        </>
      ) : null}
      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
      <BottomSheet visible={confirmCancel} onClose={() => setConfirmCancel(false)}>
        <Text style={styles.title}>Cancel this appointment?</Text>
        <Text style={styles.meta}>The slot will become available again.</Text>
        <Button
          title="Yes, cancel"
          variant="danger"
          onPress={() => {
            void cancel();
          }}
        />
        <Button
          title="Keep appointment"
          variant="secondary"
          onPress={() => setConfirmCancel(false)}
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  map: { borderRadius: 8, height: 210, marginTop: spacing.md, width: '100%' },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  price: {
    ...typography.h2,
    color: colors.gold,
    marginTop: spacing.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  timeline: { gap: spacing.xs, marginTop: spacing.md },
  timelineItem: { ...typography.caption, color: colors.textMuted, textTransform: 'capitalize' },
  timelineActive: { color: colors.info },
  timelineCopy: { flex: 1 },
  timelineMarker: { ...typography.body, color: colors.textMuted, width: 22 },
  timelineRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  timelineReached: { color: colors.info },
  timelineTime: { ...typography.caption, color: colors.textMuted },
  travelBanner: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.info,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  travelTitle: { ...typography.h3, color: colors.info },
});
