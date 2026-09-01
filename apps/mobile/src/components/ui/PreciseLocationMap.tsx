import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, {
  Circle,
  Marker,
  type MapPressEvent,
  type MarkerDragStartEndEvent,
} from 'react-native-maps';

import type { SelectedPlace } from '@/components/ui/PlacesAutocomplete';
import { colors, spacing, typography } from '@/theme';

type PreciseLocationMapProps = {
  place: SelectedPlace;
  onChange: (place: SelectedPlace) => void;
  radiusMiles?: number;
  autoLocateWhenGranted?: boolean;
};

const formattedReverseAddress = (address: Location.LocationGeocodedAddress): string =>
  [address.name ?? address.street, address.city, address.region, address.postalCode]
    .filter((part): part is string => part !== null && part !== undefined && part.length > 0)
    .join(', ');

export const PreciseLocationMap = ({
  onChange,
  place,
  radiusMiles,
  autoLocateWhenGranted = false,
}: PreciseLocationMapProps): React.ReactElement => {
  const [showArea, setShowArea] = useState(radiusMiles !== undefined);
  const [pin, setPin] = useState({ latitude: place.latitude, longitude: place.longitude });
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoLocateAttempted = useRef(false);

  useEffect(() => {
    setPin({ latitude: place.latitude, longitude: place.longitude });
  }, [place.latitude, place.longitude]);

  const chooseCoordinates = async (latitude: number, longitude: number): Promise<void> => {
    setPin({ latitude, longitude });
    setResolving(true);
    setMessage(null);
    try {
      const result = (await Location.reverseGeocodeAsync({ latitude, longitude }))[0];
      if (result === undefined) {
        onChange({ ...place, latitude, longitude });
        setMessage(
          'Exact pin saved. No mapped street address was found, so keep or edit the address manually.',
        );
        return;
      }
      const addressLine1 = result.name ?? result.street ?? place.addressLine1;
      const city = result.city ?? result.subregion ?? place.city;
      const state = result.region ?? place.state;
      const zipCode = result.postalCode ?? place.zipCode;
      onChange({
        addressLine1,
        ...(place.addressLine2 === undefined ? {} : { addressLine2: place.addressLine2 }),
        city,
        state,
        zipCode,
        latitude,
        longitude,
        formattedAddress: formattedReverseAddress(result) || place.formattedAddress,
      });
    } catch {
      onChange({ ...place, latitude, longitude });
      setMessage('Exact pin saved. Map lookup failed, so keep or edit the address manually.');
    } finally {
      setResolving(false);
    }
  };

  const chooseMapPoint = (event: MapPressEvent | MarkerDragStartEndEvent): void => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    void chooseCoordinates(latitude, longitude);
  };

  const useCurrentLocation = async (): Promise<void> => {
    setResolving(true);
    setMessage('Getting a fresh, high-accuracy device location…');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage(
          'Allow precise location in device settings, or search and place the pin manually.',
        );
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      });
      setMessage(
        location.coords.accuracy !== null
          ? `Location found within about ${Math.max(1, Math.round(location.coords.accuracy))} metres.`
          : 'Precise device location found.',
      );
      await chooseCoordinates(location.coords.latitude, location.coords.longitude);
    } catch {
      setMessage('Your current location could not be read. Search or place the pin manually.');
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    if (!autoLocateWhenGranted || autoLocateAttempted.current) return;
    autoLocateAttempted.current = true;
    void Location.getForegroundPermissionsAsync().then((permission) => {
      if (permission.granted) void useCurrentLocation();
    });
  }, [autoLocateWhenGranted]);

  const delta = showArea && radiusMiles !== undefined ? Math.max(0.03, radiusMiles / 30) : 0.006;

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setShowArea(false)}
          style={[styles.mode, !showArea && styles.modeActive]}
        >
          <Ionicons color={colors.textPrimary} name="locate-outline" size={16} />
          <Text style={styles.modeText}>Exact pin</Text>
        </Pressable>
        {radiusMiles !== undefined ? (
          <Pressable
            onPress={() => setShowArea(true)}
            style={[styles.mode, showArea && styles.modeActive]}
          >
            <Ionicons color={colors.textPrimary} name="map-outline" size={16} />
            <Text style={styles.modeText}>Service area</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Use my precise location"
          accessibilityRole="button"
          disabled={resolving}
          onPress={() => void useCurrentLocation()}
          style={styles.locationButton}
        >
          <Ionicons color={colors.info} name="navigate-outline" size={17} />
          <Text style={styles.locationButtonText}>
            {resolving ? 'Locating…' : 'Use my location'}
          </Text>
        </Pressable>
      </View>
      <MapView
        onPress={chooseMapPoint}
        region={{
          latitude: pin.latitude,
          longitude: pin.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
        style={styles.map}
      >
        <Marker
          coordinate={pin}
          draggable
          onDragEnd={chooseMapPoint}
          title="Exact service location"
        />
        {radiusMiles !== undefined ? (
          <Circle
            center={pin}
            fillColor="rgba(233,69,96,0.15)"
            radius={radiusMiles * 1609.344}
            strokeColor={colors.accent}
          />
        ) : null}
      </MapView>
      <Text style={styles.hint}>Tap the map or drag the pin to the exact entrance.</Text>
      <View style={styles.confirmation}>
        <View style={styles.flex}>
          <Text style={styles.title}>Exact location selected</Text>
          <Text style={styles.meta}>{place.formattedAddress}</Text>
        </View>
        <Text style={styles.coordinates}>
          {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
        </Text>
      </View>
      {resolving ? <Text style={styles.meta}>Matching the pin to an address...</Text> : null}
      {message !== null ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  confirmation: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.success,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  coordinates: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.bodySmall, color: colors.error },
  flex: { flex: 1 },
  hint: { ...typography.caption, color: colors.textSecondary },
  locationButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    justifyContent: 'center',
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
  },
  locationButtonText: { ...typography.caption, color: colors.info },
  map: { borderRadius: 8, height: 260, overflow: 'hidden' },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  mode: {
    alignItems: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  modeActive: { backgroundColor: colors.surfaceRaised },
  modeText: { ...typography.caption, color: colors.textPrimary },
  title: { ...typography.label, color: colors.textPrimary },
  toolbar: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  wrap: { gap: spacing.sm },
});
