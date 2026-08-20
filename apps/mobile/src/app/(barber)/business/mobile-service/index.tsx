import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import type { PlaceSearchSuggestion, SelectedPlace } from '@/components/ui/PlacesAutocomplete';
import { PreciseLocationMap } from '@/components/ui/PreciseLocationMap';
import { useBarberProfilePrivate, useUpdateBarberProfile } from '@/hooks/useBarberDashboard';
import { useMobileConfig, useUpdateMobileConfig } from '@/hooks/useMobileBarber';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import type { FeeStructure } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';

const structures: Array<{ value: FeeStructure; label: string }> = [
  { value: 'flat', label: 'Flat fee' },
  { value: 'per_mile', label: 'Per mile' },
  { value: 'free', label: 'Free' },
];

export default function MobileServiceSettingsScreen(): React.ReactElement {
  const config = useMobileConfig();
  const profile = useBarberProfilePrivate();
  const updateProfile = useUpdateBarberProfile();
  const update = useUpdateMobileConfig();
  const [enabled, setEnabled] = useState(false);
  const [radius, setRadius] = useState(10);
  const [structure, setStructure] = useState<FeeStructure>('flat');
  const [fee, setFee] = useState('15');
  const [latitude, setLatitude] = useState(40.6782);
  const [longitude, setLongitude] = useState(-73.9442);
  const [originAddress, setOriginAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [shopMessage, setShopMessage] = useState<string | null>(null);
  const [shopPlace, setShopPlace] = useState<SelectedPlace | null>(null);

  useEffect(() => {
    const current = config.data;
    if (current === undefined) return;
    setEnabled(current.isEnabled);
    setRadius(current.serviceRadiusMiles ?? 10);
    setStructure(current.feeStructure ?? 'flat');
    setFee(
      String(
        ((current.feeStructure === 'per_mile' ? current.perMileRateCents : current.baseFeeCents) ??
          current.suggestedFee.flat) / 100,
      ),
    );
    setLatitude(current.originLatitude ?? profile.data?.latitude ?? 40.6782);
    setLongitude(current.originLongitude ?? profile.data?.longitude ?? -73.9442);
    setOriginAddress(current.originAddress ?? profile.data?.address ?? '');
    setNotes(current.mobileServiceNotes ?? '');
  }, [config.data, profile.data]);

  useEffect(() => {
    const current = profile.data;
    if (current === undefined) return;
    setShopPlace({
      addressLine1: current.address ?? '',
      city: current.city ?? '',
      state: current.state ?? '',
      zipCode: current.zipCode ?? '',
      latitude: current.latitude ?? 37.6456,
      longitude: current.longitude ?? -84.7722,
      formattedAddress:
        [current.address, current.city, current.state, current.zipCode]
          .filter((part): part is string => typeof part === 'string' && part.length > 0)
          .join(', ') || 'Place the exact shop pin',
    });
  }, [profile.data]);

  const loadShopSuggestions = useCallback(
    async (query: string): Promise<PlaceSearchSuggestion[]> => {
      const result = await mobileApi.barber.searchShopLocations({ query });
      return result.suggestions.map((suggestion) => ({
        id: suggestion.placeId ?? `${suggestion.latitude},${suggestion.longitude}`,
        description: suggestion.formattedAddress,
        place: {
          addressLine1: suggestion.addressLine1,
          city: suggestion.city,
          state: suggestion.state,
          zipCode: suggestion.zipCode,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          formattedAddress: suggestion.formattedAddress,
        },
      }));
    },
    [],
  );

  const updateShopField = (
    field: 'addressLine1' | 'city' | 'state' | 'zipCode',
    value: string,
  ): void => {
    if (shopPlace === null) return;
    const next = { ...shopPlace, [field]: value };
    setShopPlace({
      ...next,
      formattedAddress: [next.addressLine1, next.city, next.state, next.zipCode]
        .filter((part) => part.trim().length > 0)
        .join(', '),
    });
  };

  const saveShop = async (): Promise<void> => {
    if (shopPlace === null) return;
    setShopMessage(null);
    try {
      await updateProfile.mutateAsync({
        address: shopPlace.addressLine1,
        city: shopPlace.city,
        state: shopPlace.state,
        zipCode: shopPlace.zipCode,
        latitude: shopPlace.latitude,
        longitude: shopPlace.longitude,
      });
      setShopMessage('Shop address and exact map pin saved.');
    } catch (error) {
      setShopMessage(errorMessage(error));
    }
  };

  const save = async (): Promise<void> => {
    setMessage(null);
    try {
      await update.mutateAsync({
        isEnabled: enabled,
        serviceRadiusMiles: radius,
        feeStructure: structure,
        baseFeeCents: structure === 'flat' ? Math.round(Number(fee) * 100) : 0,
        perMileRateCents: structure === 'per_mile' ? Math.round(Number(fee) * 100) : 0,
        originLatitude: latitude,
        originLongitude: longitude,
        originAddress: originAddress || undefined,
        mobileServiceNotes: notes || undefined,
      });
      setMessage('Mobile service settings saved.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const suggestion = config.data?.suggestedFee;
  const originPlace: SelectedPlace = {
    addressLine1: originAddress,
    city: '',
    state: '',
    zipCode: '',
    latitude,
    longitude,
    formattedAddress: originAddress || 'Current mobile-service origin',
  };
  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Service locations"
        subtitle="Keep your shop pin and mobile origin precise."
      />
      <Card>
        <Text style={styles.title}>Shop address</Text>
        <Text style={styles.meta}>
          Search Google locations, use your precise device position, or enter the address manually.
          This is the client-facing shop location.
        </Text>
        <PlacesAutocomplete
          initialValue={shopPlace?.formattedAddress ?? ''}
          label="Search shop name or address"
          loadSuggestions={loadShopSuggestions}
          onSelect={setShopPlace}
          onUseManual={(address) => {
            if (shopPlace === null) return;
            setShopPlace({ ...shopPlace, addressLine1: address, formattedAddress: address });
            setShopMessage('Manual address selected. Complete the fields and confirm the pin.');
          }}
          placeholder="Start typing a shop or street address"
        />
        {shopPlace !== null ? (
          <>
            <PreciseLocationMap place={shopPlace} onChange={setShopPlace} />
            <Input
              label="Street, building, or suite"
              onChangeText={(value) => updateShopField('addressLine1', value)}
              value={shopPlace.addressLine1}
            />
            <Input
              label="City"
              onChangeText={(value) => updateShopField('city', value)}
              value={shopPlace.city}
            />
            <View style={styles.addressRow}>
              <View style={styles.flex}>
                <Input
                  label="State"
                  onChangeText={(value) => updateShopField('state', value)}
                  value={shopPlace.state}
                />
              </View>
              <View style={styles.flex}>
                <Input
                  label="ZIP code"
                  keyboardType="number-pad"
                  onChangeText={(value) => updateShopField('zipCode', value)}
                  value={shopPlace.zipCode}
                />
              </View>
            </View>
            {shopMessage !== null ? <Text style={styles.message}>{shopMessage}</Text> : null}
            <Button
              disabled={
                updateProfile.isPending ||
                shopPlace.addressLine1.trim().length === 0 ||
                shopPlace.city.trim().length === 0 ||
                shopPlace.state.trim().length === 0 ||
                shopPlace.zipCode.trim().length === 0
              }
              title={updateProfile.isPending ? 'Saving shop…' : 'Save shop address'}
              onPress={() => void saveShop()}
              variant="secondary"
            />
          </>
        ) : null}
      </Card>
      <Card style={styles.toggleCard}>
        <View style={styles.flex}>
          <Text style={styles.title}>Offer mobile visits</Text>
          <Text style={styles.meta}>Travel to homes, offices, and hotels.</Text>
        </View>
        <Switch
          ios_backgroundColor={colors.surfaceRaised}
          thumbColor={enabled ? colors.textPrimary : colors.textMuted}
          trackColor={{ false: colors.surfaceRaised, true: colors.borderLight }}
          value={enabled}
          onValueChange={setEnabled}
        />
      </Card>
      {enabled ? (
        <>
          <Card>
            <Text style={styles.title}>Travel fee</Text>
            <View style={styles.segmented}>
              {structures.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setStructure(item.value)}
                  style={[styles.segment, structure === item.value && styles.segmentActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      structure === item.value && styles.segmentTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {structure !== 'free' ? (
              <Input
                label={structure === 'flat' ? 'Flat fee ($)' : 'Rate per mile ($)'}
                value={fee}
                onChangeText={setFee}
                keyboardType="decimal-pad"
              />
            ) : null}
            {suggestion !== undefined ? (
              <Button
                variant="secondary"
                title={`Use suggested $${((structure === 'per_mile' ? suggestion.perMile : suggestion.flat) / 100).toFixed(2)}`}
                onPress={() =>
                  setFee(
                    String((structure === 'per_mile' ? suggestion.perMile : suggestion.flat) / 100),
                  )
                }
              />
            ) : null}
          </Card>
          <PlacesAutocomplete
            initialValue={originAddress}
            label="Mobile-service origin"
            loadSuggestions={loadShopSuggestions}
            onSelect={(place) => {
              setOriginAddress(place.formattedAddress);
              setLatitude(place.latitude);
              setLongitude(place.longitude);
            }}
            onUseManual={setOriginAddress}
          />
          <PreciseLocationMap
            autoLocateWhenGranted
            place={originPlace}
            radiusMiles={radius}
            onChange={(place) => {
              setOriginAddress(place.formattedAddress);
              setLatitude(place.latitude);
              setLongitude(place.longitude);
            }}
          />
          <Text style={styles.meta}>
            With precise-location permission, this origin refreshes when you open this screen.
            During an active client journey, background tracking continues automatically until you
            arrive.
          </Text>
          <Card>
            <Text style={styles.title}>Service radius: {radius.toFixed(0)} miles</Text>
            <Slider
              maximumTrackTintColor={colors.border}
              maximumValue={50}
              minimumTrackTintColor={colors.accent}
              minimumValue={1}
              onValueChange={setRadius}
              step={1}
              thumbTintColor={colors.accentLight}
              value={radius}
            />
          </Card>
          <Input
            label="Notes for clients"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Equipment or space requirements"
          />
        </>
      ) : (
        <Card>
          <Text style={styles.meta}>
            Enable mobile visits when you are ready to travel to clients.
          </Text>
        </Card>
      )}
      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
      <Button disabled={update.isPending} title="Save settings" onPress={() => void save()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  addressRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  message: { ...typography.bodySmall, color: colors.textSecondary },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  segment: { borderRadius: 6, flex: 1, padding: spacing.sm },
  segmentActive: { backgroundColor: colors.accent },
  segmented: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segmentText: { ...typography.label, color: colors.textPrimary, textAlign: 'center' },
  segmentTextActive: { color: colors.textOnAccent },
  title: { ...typography.h3, color: colors.textPrimary },
  toggleCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
});
