import { ApiError } from '@barber-saas/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import type { SelectedPlace } from '@/components/ui/PlacesAutocomplete';
import { PreciseLocationMap } from '@/components/ui/PreciseLocationMap';
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
    appointmentType?: string;
    designId?: string;
  }>();
  const barberId = params.barberId ?? '';
  const addresses = useClientAddresses();
  const services = useBarberServices(barberId);
  const estimate = useTravelEstimate();
  const createAddress = useCreateAddress();
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
    estimate.reset();
    estimate.mutate({
      barberId,
      destinationLatitude: Number(destination.latitude),
      destinationLongitude: Number(destination.longitude),
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
          addressLine2: oneTime.addressLine2,
          city: oneTime.city,
          state: oneTime.state,
          zipCode: oneTime.zipCode,
          country: 'US',
          latitude: oneTime.latitude,
          longitude: oneTime.longitude,
        });
        addressId = saved.id;
      }
      const destinationParams = new URLSearchParams({
        serviceId: params.serviceId ?? '',
        appointmentType: 'mobile',
        travelMinutes: String(travel?.estimatedTravelMinutes ?? 0),
        travelFee: String(travel?.travelFee ?? 0),
      });
      if (params.designId !== undefined) destinationParams.set('designId', params.designId);
      if (estimateSoftError) destinationParams.set('estimateUnavailable', 'true');
      if (addressId !== undefined) destinationParams.set('addressId', addressId);
      else if (oneTime !== null) destinationParams.set('address', JSON.stringify(oneTime));
      router.push(`/(client)/discover/${barberId}/book/slot?${destinationParams.toString()}`);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const travel = estimate.data;
  const outsideRadius =
    estimate.error instanceof ApiError && estimate.error.code === 'OUTSIDE_SERVICE_AREA';
  const estimateSoftError = estimate.isError && !outsideRadius;
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
        {oneTime !== null ? <PreciseLocationMap place={oneTime} onChange={setOneTime} /> : null}
        {oneTime !== null ? (
          <View style={styles.row}>
            <Text style={[styles.meta, styles.flex]}>Save this address to my profile</Text>
            <Switch
              ios_backgroundColor={colors.surfaceRaised}
              thumbColor={saveAddress ? colors.textPrimary : colors.textMuted}
              trackColor={{ false: colors.surfaceRaised, true: colors.borderLight }}
              value={saveAddress}
              onValueChange={setSaveAddress}
            />
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
      {estimate.isPending ? (
        <Card>
          <View style={styles.row}>
            <ActivityIndicator color={colors.info} />
            <View style={styles.flex}>
              <Text style={styles.title}>Calculating travel</Text>
              <Text style={styles.meta}>Checking distance, drive time, and fee...</Text>
            </View>
          </View>
        </Card>
      ) : null}
      {outsideRadius ? (
        <Card style={styles.errorCard}>
          <Text style={styles.title}>Outside service area</Text>
          <Text style={styles.meta}>{errorMessage(estimate.error)}</Text>
        </Card>
      ) : null}
      {estimateSoftError ? (
        <Card style={styles.warningCard}>
          <Text style={styles.title}>Travel estimate unavailable</Text>
          <Text style={styles.meta}>
            Your barber will confirm arrival details. You can still continue.
          </Text>
        </Card>
      ) : null}
      {error !== null ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        disabled={
          estimate.isPending || outsideRadius || (selected === undefined && oneTime === null)
        }
        title="Continue"
        onPress={() => void submit()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { backgroundColor: colors.border, height: 1, marginVertical: spacing.sm },
  error: { ...typography.bodySmall, color: colors.error },
  errorCard: { borderColor: colors.error },
  flex: { flex: 1 },
  meta: { ...typography.body, color: colors.textSecondary },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  selected: { borderColor: colors.success },
  title: { ...typography.h3, color: colors.textPrimary },
  total: { ...typography.h3, color: colors.goldText, marginTop: spacing.sm },
  warningCard: { borderColor: colors.warning },
});
