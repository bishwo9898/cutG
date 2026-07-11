import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import { useBarberProfilePrivate } from '@/hooks/useBarberDashboard';
import { useMobileConfig, useUpdateMobileConfig } from '@/hooks/useMobileBarber';
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
  return (
    <Screen>
      <ScreenHeader showBack title="Mobile Barber" subtitle="Set your travel area and fee." />
      <Card style={styles.toggleCard}>
        <View style={styles.flex}>
          <Text style={styles.title}>Offer mobile visits</Text>
          <Text style={styles.meta}>Travel to homes, offices, and hotels.</Text>
        </View>
        <Switch value={enabled} onValueChange={setEnabled} />
      </Card>
      {enabled ? (
        <>
          <MapView
            style={styles.map}
            region={{ latitude, longitude, latitudeDelta: 0.25, longitudeDelta: 0.25 }}
          >
            <Marker coordinate={{ latitude, longitude }} />
            <Circle
              center={{ latitude, longitude }}
              radius={radius * 1609.344}
              fillColor="rgba(233,69,96,0.15)"
              strokeColor={colors.accent}
            />
          </MapView>
          <Card>
            <Text style={styles.title}>Service radius: {radius.toFixed(0)} miles</Text>
            <Slider
              minimumValue={1}
              maximumValue={50}
              step={1}
              value={radius}
              onValueChange={setRadius}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.accentLight}
            />
          </Card>
          <Card>
            <Text style={styles.title}>Travel fee</Text>
            <View style={styles.segmented}>
              {structures.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setStructure(item.value)}
                  style={[styles.segment, structure === item.value && styles.segmentActive]}
                >
                  <Text style={styles.segmentText}>{item.label}</Text>
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
            onSelect={(place) => {
              setOriginAddress(place.formattedAddress);
              setLatitude(place.latitude);
              setLongitude(place.longitude);
            }}
          />
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
  flex: { flex: 1 },
  map: { borderRadius: 8, height: 260, overflow: 'hidden' },
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
  title: { ...typography.h3, color: colors.textPrimary },
  toggleCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
});
