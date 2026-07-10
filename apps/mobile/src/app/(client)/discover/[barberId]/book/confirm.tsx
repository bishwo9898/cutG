import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useBookAppointment } from '@/hooks/useAppointments';
import { useBarberProfile, useBarberServices, useBarberSlots } from '@/hooks/useBarbers';
import { errorMessage } from '@/lib/errors';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

export default function ConfirmBookingScreen(): React.ReactElement {
  const {
    barberId = '',
    serviceId = '',
    slotId = '',
    date = '',
  } = useLocalSearchParams<{
    barberId?: string;
    serviceId?: string;
    slotId?: string;
    date?: string;
  }>();
  const [notes, setNotes] = useState('');
  const [payAtShop, setPayAtShop] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = useBarberProfile(barberId);
  const services = useBarberServices(barberId);
  const slots = useBarberSlots(barberId, date);
  const book = useBookAppointment();
  const service = listFromResponse(services.data ?? {}).find((item) => item.id === serviceId);
  const slot = listFromResponse(slots.data ?? {}).find((item) => item.id === slotId);
  const canPayOnline = profile.data?.stripeChargesEnabled === true;

  const confirm = async (): Promise<void> => {
    setError(null);
    try {
      const appointment = await book.mutateAsync({
        barberId,
        serviceId,
        availabilitySlotId: slotId,
        clientNotes: notes || undefined,
      });
      if (canPayOnline && !payAtShop) {
        router.replace(
          '/(client)/discover/' + barberId + '/book/payment?appointmentId=' + appointment.id,
        );
      } else {
        router.replace('/(client)/appointments/' + appointment.id);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <Screen>
      <ScreenHeader showBack title="Step 3 of 3" subtitle="Confirm your appointment." />
      <Card>
        <Text style={styles.title}>{profile.data?.businessName ?? 'Barber'}</Text>
        <Text style={styles.meta}>
          {service?.name ?? 'Service'} ·{' '}
          {service === undefined ? '' : '$' + service.price.toFixed(2)}
        </Text>
        <Text style={styles.meta}>
          {date} at {slot?.startTime ?? 'Selected time'}
        </Text>
      </Card>
      <Input
        label="Notes for barber"
        onChangeText={setNotes}
        value={notes}
        placeholder="Optional"
        multiline
      />
      <View style={styles.payRow}>
        <View style={styles.payText}>
          <Text style={styles.title}>Pay at shop</Text>
          <Text style={styles.meta}>
            {canPayOnline
              ? 'Skip card payment for now.'
              : 'Required until this barber enables Stripe.'}
          </Text>
        </View>
        <Switch
          value={payAtShop || !canPayOnline}
          onValueChange={setPayAtShop}
          disabled={!canPayOnline}
        />
      </View>
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={book.isPending}
        title={canPayOnline && !payAtShop ? 'Confirm & Pay' : 'Confirm Pay at Shop'}
        onPress={() => {
          void confirm();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: {
    ...typography.bodySmall,
    color: colors.error,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  payRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  payText: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
});
