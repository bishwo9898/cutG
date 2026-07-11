import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import type { SelectedPlace } from '@/components/ui/PlacesAutocomplete';
import { useBookAppointment } from '@/hooks/useAppointments';
import { useBarberServices } from '@/hooks/useBarbers';
import { useClientAddresses, useCreateAddress, useTravelEstimate } from '@/hooks/useMobileBarber';
import { errorMessage } from '@/lib/errors';
import { listFromResponse } from '@/lib/types';
import type { ClientAddress } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

export default function SelectAddressScreen(): React.ReactElement {
  const params = useLocalSearchParams<{
    barberId?: string;
    serviceId?: string;
    slotId?: string;
    notes?: string;
    payAtShop?: string;
  }>();
  const barberId = params.barberId ?? '';
  const addresses = useClientAddresses();
  const services = useBarberServices(barberId);
  const estimate = useTravelEstimate();
  const createAddress = useCreateAddress();
  const book = useBookAppointment();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [oneTime, setOneTime] = useState<SelectedPlace | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const service = listFromResponse(services.data ?? {}).find(
    (item) => item.id === params.serviceId,
  );
  const selected = useMemo(
    () => (addresses.data?.addresses ?? []).find((address) => address.id === selectedId),
    [addresses.data, selectedId],
  );

  useEffect(() => {
    const initial =
      (addresses.data?.addresses ?? []).find((address) => address.isDefault) ??
      addresses.data?.addresses[0];
    if (selectedId === null && initial !== undefined) setSelectedId(initial.id);
  }, [addresses.data, selectedId]);

  useEffect(() => {
    const destination = selected ?? oneTime;
    if (destination === null || destination === undefined || barberId.length === 0) return;
    estimate.mutate({
      barberId,
      destinationLatitude: destination.latitude,
      destinationLongitude: destination.longitude,
    });
  }, [barberId, selected?.id, oneTime?.latitude, oneTime?.longitude]);

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      let addressId = selected?.id;
      if (oneTime !== null && saveAddress) {
        const saved = await createAddress.mutateAsync({
          label: 'Mobile visit',
          addressLine1: oneTime.addressLine1,
          city: oneTime.city,
          state: oneTime.state,
          zipCode: oneTime.zipCode,
          country: 'US',
        });
        addressId = saved.id;
      }
      const appointment = await book.mutateAsync({
        barberId,
        serviceId: params.serviceId ?? '',
        availabilitySlotId: params.slotId ?? '',
        clientNotes: params.notes || undefined,
        isMobileService: true,
        ...(addressId !== undefined
          ? { clientAddressId: addressId }
          : oneTime === null
            ? {}
            : {
                clientAddressOneTime: {
                  addressLine1: oneTime.addressLine1,
                  city: oneTime.city,
                  state: oneTime.state,
                  zipCode: oneTime.zipCode,
                  country: 'US',
                },
              }),
      });
      if (params.payAtShop !== 'true') {
        router.replace(
          `/(client)/discover/${barberId}/book/payment?appointmentId=${appointment.id}`,
        );
      } else {
        router.replace('/(client)/appointments/' + appointment.id);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const travel = estimate.data;
  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Where should we come?"
        subtitle="Select the mobile service address."
      />
      {(addresses.data?.addresses ?? []).map((address: ClientAddress) => (
        <Pressable
          key={address.id}
          onPress={() => {
            setSelectedId(address.id);
            setOneTime(null);
          }}
        >
          <Card style={selectedId === address.id ? styles.selected : undefined}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.title}>{address.label}</Text>
                <Text style={styles.meta}>
                  {address.addressLine1}, {address.city}
                </Text>
              </View>
              {selectedId === address.id ? <Badge label="Selected" tone="success" /> : null}
            </View>
          </Card>
        </Pressable>
      ))}
      <Card>
        <Text style={styles.title}>Use a different address</Text>
        <PlacesAutocomplete
          onSelect={(place) => {
            setOneTime(place);
            setSelectedId(null);
          }}
        />
        {oneTime !== null ? (
          <View style={styles.row}>
            <Text style={[styles.meta, styles.flex]}>Save this address to my profile</Text>
            <Switch value={saveAddress} onValueChange={setSaveAddress} />
          </View>
        ) : null}
      </Card>
      {travel !== undefined ? (
        <Card>
          <Text style={styles.title}>Travel estimate</Text>
          <Text style={styles.meta}>{travel.distanceMiles.toFixed(1)} miles away</Text>
          <Text style={styles.meta}>About {travel.estimatedTravelMinutes} min travel</Text>
          <View style={styles.divider} />
          <Text style={styles.meta}>Service: ${(service?.price ?? 0).toFixed(2)}</Text>
          <Text style={styles.meta}>Travel fee: ${travel.travelFee.toFixed(2)}</Text>
          <Text style={styles.total}>
            Total: ${((service?.price ?? 0) + travel.travelFee).toFixed(2)}
          </Text>
        </Card>
      ) : null}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={estimate.isPending || travel === undefined || book.isPending}
        title="Continue"
        onPress={() => void submit()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.sm },
  error: { ...typography.bodySmall, color: colors.error },
  flex: { flex: 1 },
  meta: { ...typography.body, color: colors.textSecondary },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  selected: { borderColor: colors.success },
  title: { ...typography.h3, color: colors.textPrimary },
  total: { ...typography.h3, color: colors.gold, marginTop: spacing.sm },
});
