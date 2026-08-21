import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useBookAppointment } from '@/hooks/useAppointments';
import { useBarberProfile, useBarberServices, useBarberSlots } from '@/hooks/useBarbers';
import { errorMessage } from '@/lib/errors';
import { mobileApi } from '@/lib/apiClient';
import { optionalDesignReference } from '@/lib/hairStudio';
import { listFromResponse } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

type OneTimeAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  latitude: number;
  longitude: number;
};

export default function ConfirmBookingScreen(): React.ReactElement {
  const params = useLocalSearchParams<{
    barberId?: string;
    serviceId?: string;
    slotId?: string;
    date?: string;
    appointmentType?: string;
    addressId?: string;
    address?: string;
    travelMinutes?: string;
    travelFee?: string;
    estimateUnavailable?: string;
    designId?: string;
  }>();
  const barberId = params.barberId ?? '';
  const serviceId = params.serviceId ?? '';
  const slotId = params.slotId ?? '';
  const date = params.date ?? '';
  const isMobile = params.appointmentType === 'mobile';
  const oneTimeAddress =
    params.address === undefined ? null : (JSON.parse(params.address) as OneTimeAddress);
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
  const travelFee = isMobile ? Number(params.travelFee ?? 0) : 0;
  const estimateUnavailable = params.estimateUnavailable === 'true';
  const total = (service?.price ?? 0) + travelFee;
  const design = useQuery({
    queryKey: ['hair-design', params.designId],
    queryFn: () => mobileApi.client.design(params.designId ?? ''),
    enabled: params.designId !== undefined,
  });

  const confirm = async (): Promise<void> => {
    setError(null);
    try {
      const appointment = await book.mutateAsync({
        barberId,
        serviceId,
        availabilitySlotId: slotId,
        ...optionalDesignReference(params.designId),
        paymentMethod: canPayOnline && !payAtShop ? 'CARD' : 'CASH',
        clientNotes: notes || undefined,
        isMobileService: isMobile,
        ...(isMobile
          ? params.addressId !== undefined
            ? { clientAddressId: params.addressId }
            : {
                clientAddressOneTime: {
                  addressLine1: oneTimeAddress?.addressLine1 ?? '',
                  addressLine2: oneTimeAddress?.addressLine2,
                  city: oneTimeAddress?.city ?? '',
                  state: oneTimeAddress?.state ?? '',
                  zipCode: oneTimeAddress?.zipCode ?? '',
                  country: oneTimeAddress?.country ?? 'US',
                  latitude: oneTimeAddress?.latitude,
                  longitude: oneTimeAddress?.longitude,
                },
              }
          : {}),
      });
      if (canPayOnline && !payAtShop) {
        router.replace(
          `/(client)/discover/${barberId}/book/payment?appointmentId=${appointment.id}&total=${total.toFixed(2)}`,
        );
      } else router.replace('/(client)/appointments/' + appointment.id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Review booking"
        subtitle="Confirm the details before payment."
      />
      <Card>
        {isMobile ? <Text style={styles.mobileLabel}>Mobile appointment</Text> : null}
        <Text style={styles.title}>{profile.data?.businessName ?? 'Barber'}</Text>
        <Text style={styles.meta}>
          {service?.name ?? 'Service'} · {service?.durationMinutes ?? 0} min
        </Text>
        <Text style={styles.meta}>
          {date} at {slot?.startTime ?? 'Selected time'}
        </Text>
        {isMobile && oneTimeAddress !== null ? (
          <Text style={styles.address}>
            Barber travels to {oneTimeAddress.addressLine1}, {oneTimeAddress.city},{' '}
            {oneTimeAddress.state}
          </Text>
        ) : isMobile ? (
          <Text style={styles.address}>Barber travels to your saved address.</Text>
        ) : null}
        <View style={styles.divider} />
        <View style={styles.priceRow}>
          <Text style={styles.meta}>Service fee</Text>
          <Text style={styles.value}>${(service?.price ?? 0).toFixed(2)}</Text>
        </View>
        {isMobile ? (
          <View style={styles.priceRow}>
            <Text style={styles.meta}>Travel fee</Text>
            <Text style={styles.value}>
              {estimateUnavailable ? 'Barber confirms' : `$${travelFee.toFixed(2)}`}
            </Text>
          </View>
        ) : null}
        {isMobile && estimateUnavailable ? (
          <Text style={styles.warning}>
            Travel timing and fee will be confirmed before the appointment.
          </Text>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.total}>Total</Text>
          <Text style={styles.total}>${total.toFixed(2)}</Text>
        </View>
      </Card>
      {design.data !== undefined ? (
        <Card>
          <Text style={styles.mobileLabel}>STYLE REFERENCE</Text>
          <View style={styles.designRow}>
            {design.data.generatedPreviewUrl !== null ? (
              <Image source={{ uri: design.data.generatedPreviewUrl }} style={styles.designImage} />
            ) : null}
            <View style={styles.flex}>
              <Text style={styles.title}>{design.data.styleName}</Text>
              <Text style={styles.meta}>
                This private preview will be attached for your barber.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
      <Input
        label="Notes for your barber"
        onChangeText={setNotes}
        value={notes}
        placeholder="Optional"
        multiline
      />
      <View style={styles.payRow}>
        <View style={styles.payText}>
          <Text style={styles.title}>Pay at appointment</Text>
          <Text style={styles.meta}>
            {canPayOnline
              ? 'Skip card payment for now.'
              : 'Required until this barber completes online payment setup.'}
          </Text>
        </View>
        <Switch
          ios_backgroundColor={colors.surfaceRaised}
          thumbColor={payAtShop || !canPayOnline ? colors.textPrimary : colors.textMuted}
          trackColor={{ false: colors.surfaceRaised, true: colors.borderLight }}
          value={payAtShop || !canPayOnline}
          onValueChange={setPayAtShop}
          disabled={!canPayOnline}
        />
      </View>
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={book.isPending}
        title={
          book.isPending
            ? 'Confirming...'
            : canPayOnline && !payAtShop
              ? `Confirm & Pay $${total.toFixed(2)}`
              : 'Confirm appointment'
        }
        onPress={() => {
          void confirm();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  address: { ...typography.bodySmall, color: colors.info, marginTop: spacing.md },
  designImage: { borderRadius: 10, height: 96, width: 78 },
  designRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.md },
  error: { ...typography.bodySmall, color: colors.error },
  flex: { flex: 1 },
  meta: { ...typography.body, color: colors.textSecondary },
  mobileLabel: { ...typography.label, color: colors.info, marginBottom: spacing.sm },
  payRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  payText: { flex: 1 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  total: { ...typography.h3, color: colors.gold },
  value: { ...typography.body, color: colors.textPrimary },
  warning: { ...typography.bodySmall, color: colors.warning, marginTop: spacing.md },
});
