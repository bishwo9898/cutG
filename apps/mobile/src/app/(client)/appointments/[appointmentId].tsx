import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
import { usePaymentStatus } from '@/hooks/usePayments';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

export default function ClientAppointmentDetailScreen(): React.ReactElement {
  const { appointmentId = '' } = useLocalSearchParams<{ appointmentId?: string }>();
  const appointment = useClientAppointment(appointmentId);
  const payment = usePaymentStatus(appointmentId);
  const cancelAppointment = useCancelAppointment();
  const review = useCreateReview();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState<string | null>(null);

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
            <Text style={styles.price}>{'$' + item.price.toFixed(2)}</Text>
          </Card>
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
});
