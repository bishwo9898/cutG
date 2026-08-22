import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MarketplaceBarberResult, ShopLocationSuggestion } from '@barber-saas/shared-types';

import { BarberCard } from '@/components/barber/BarberCard';
import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import type { PublicBarber } from '@/lib/types';
import { colors, spacing, typography } from '@/theme';
import { useClientAddresses } from '@/hooks/useMobileBarber';

const categories = ['', 'haircut', 'beard', 'shave', 'color', 'combo', 'kids', 'other'];
type Point = { label: string; latitude: number; longitude: number };

const toCard = (item: MarketplaceBarberResult): PublicBarber => ({
  id: item.id,
  businessName: item.businessName,
  bio: item.bio,
  profilePhotoUrl: item.profilePhotoUrl,
  city: item.city,
  state: item.state,
  averageRating: item.averageRating,
  totalReviews: item.totalReviews,
  isVerified: item.capabilities.verified,
  subscriptionTier: 'FREE',
  lowestServicePrice: item.lowestMatchingPrice,
  serviceCategories: item.serviceCategories as PublicBarber['serviceCategories'],
  nextAvailableSlot: item.nextAvailableSlot,
  distanceMiles: item.distanceMiles,
  onlinePaymentsAvailable: item.capabilities.onlinePayments,
  mobileService: item.capabilities.mobileVisits
    ? {
        isEnabled: true,
        serviceRadiusMiles: 50,
        travelFeeStructure: 'free',
        baseFee: 0,
        perMileRate: null,
        notes: null,
      }
    : null,
});

export default function SearchResultsScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ designId?: string; category?: string }>();
  const [locationText, setLocationText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [location, setLocation] = useState<Point | null>(null);
  const [category, setCategory] = useState(params.category ?? '');
  const [distance, setDistance] = useState(50);
  const [maxPrice, setMaxPrice] = useState(200);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const addresses = useClientAddresses();

  useEffect(() => {
    if (location !== null || locationText.length > 0) return;
    const saved = addresses.data?.addresses.find((address) => address.isDefault);
    if (saved === undefined) return;
    const label = [saved.addressLine1, saved.city, saved.state, saved.zipCode]
      .filter(Boolean)
      .join(', ');
    setLocation({ label, latitude: saved.latitude, longitude: saved.longitude });
    setLocationText(label);
  }, [addresses.data?.addresses, location, locationText.length]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(locationText.trim()), 350);
    return (): void => clearTimeout(id);
  }, [locationText]);

  const suggestions = useQuery({
    queryKey: ['market-location-search', debounced],
    queryFn: () => mobileApi.client.searchLocations({ query: debounced }),
    enabled: debounced.length >= 3 && debounced !== location?.label,
  });
  const request = useMemo(
    () => ({
      ...(location === null ? {} : { location }),
      ...(category === '' ? {} : { category: category as never }),
      ...(distance >= 50 || location === null ? {} : { maxDistanceMiles: distance }),
      ...(maxPrice >= 200 ? {} : { maxPrice }),
      page: 1,
      limit: 48,
    }),
    [category, distance, location, maxPrice],
  );
  const results = useQuery({
    queryKey: ['marketplace-search', request],
    queryFn: () => mobileApi.discovery.marketplaceSearch(request),
  });
  const design = useQuery({
    queryKey: ['hair-design', params.designId],
    queryFn: () => mobileApi.client.design(params.designId ?? ''),
    enabled: params.designId !== undefined,
  });

  const chooseSuggestion = (item: ShopLocationSuggestion): void => {
    setLocation({
      label: item.formattedAddress,
      latitude: item.latitude,
      longitude: item.longitude,
    });
    setLocationText(item.formattedAddress);
    setPermissionMessage(null);
  };

  const useCurrentLocation = async (): Promise<void> => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setPermissionMessage('Location permission was not granted. Type an address instead.');
      return;
    }
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    const point = {
      label: 'Current location',
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
    setLocation(point);
    setLocationText(point.label);
    setPermissionMessage(null);
  };

  const barbers = (results.data?.barbers ?? []).map(toCard);

  return (
    <Screen
      refreshing={results.isFetching}
      onRefresh={() => {
        void results.refetch();
      }}
    >
      <ScreenHeader
        showBack
        title="Find your barber"
        subtitle="Start with a location, then narrow only when needed."
      />
      {design.data !== undefined ? (
        <View style={styles.designBanner}>
          <Text style={styles.filterTitle}>Booking for {design.data.styleName}</Text>
          <Text style={styles.muted}>Your barber will receive the private preview.</Text>
        </View>
      ) : null}

      <Input
        autoCapitalize="words"
        label="Location"
        onChangeText={(value) => {
          setLocationText(value);
          if (value !== location?.label) setLocation(null);
        }}
        value={locationText}
        placeholder="Address, neighborhood, city, or ZIP"
      />
      {suggestions.data?.suggestions.map((item) => (
        <Pressable
          key={item.placeId ?? item.formattedAddress}
          onPress={() => chooseSuggestion(item)}
          style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
        >
          <Ionicons color={colors.textSecondary} name="location-outline" size={18} />
          <View style={styles.suggestionCopy}>
            <Text style={styles.filterTitle}>{item.name}</Text>
            <Text numberOfLines={2} style={styles.muted}>
              {item.formattedAddress}
            </Text>
          </View>
        </Pressable>
      ))}
      <Button
        icon={<Ionicons color={colors.textPrimary} name="navigate-outline" size={17} />}
        onPress={() => void useCurrentLocation()}
        title="Use my current location"
        variant="secondary"
      />
      {permissionMessage !== null ? <Text style={styles.warning}>{permissionMessage}</Text> : null}

      <View style={styles.filterBox}>
        <Text style={styles.filterTitle}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {categories.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: category === item }}
              key={item || 'any'}
              onPress={() => setCategory(item)}
              style={({ pressed }) => [
                styles.chip,
                category === item && styles.chipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, category === item && styles.chipTextSelected]}>
                {item === '' ? 'Any' : item.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.sliderHeading}>
          <Text style={styles.filterTitle}>Distance</Text>
          <Text style={styles.muted}>
            {distance >= 50 ? '50+ miles · Any' : `${distance} miles`}
          </Text>
        </View>
        <Slider
          accessibilityLabel="Maximum distance"
          maximumTrackTintColor={colors.border}
          maximumValue={50}
          minimumTrackTintColor={colors.gold}
          minimumValue={5}
          onValueChange={(value: number) => setDistance(Math.round(value / 5) * 5)}
          step={5}
          thumbTintColor={colors.primary}
          value={distance}
        />
        <View style={styles.sliderHeading}>
          <Text style={styles.filterTitle}>Maximum price</Text>
          <Text style={styles.muted}>{maxPrice >= 200 ? '$200+ · Any' : `$${maxPrice}`}</Text>
        </View>
        <Slider
          accessibilityLabel="Maximum service price"
          maximumTrackTintColor={colors.border}
          maximumValue={200}
          minimumTrackTintColor={colors.gold}
          minimumValue={10}
          onValueChange={(value: number) => setMaxPrice(Math.round(value / 10) * 10)}
          step={10}
          thumbTintColor={colors.primary}
          value={maxPrice}
        />
      </View>

      {barbers.length === 0 && !results.isLoading ? (
        <EmptyState
          title="No matches yet"
          message="Try Any distance or Any price to see more barbers."
        />
      ) : null}
      {barbers.map((barber) => (
        <BarberCard
          barber={barber}
          href={`/(client)/discover/${barber.id}${params.designId ? `?designId=${params.designId}` : ''}`}
          key={barber.id}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { backgroundColor: '#EDE2CF', borderColor: colors.gold },
  chipText: { ...typography.bodySmall, color: colors.textSecondary, textTransform: 'capitalize' },
  chipTextSelected: { color: colors.textPrimary, fontWeight: '700' },
  chips: { gap: spacing.sm },
  designBanner: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.gold,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  filterBox: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  filterTitle: { ...typography.label, color: colors.textPrimary },
  muted: { ...typography.bodySmall, color: colors.textSecondary },
  pressed: { backgroundColor: '#F6EAE7', opacity: 0.95 },
  sliderHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  suggestion: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  suggestionCopy: { flex: 1, gap: 2 },
  warning: { ...typography.bodySmall, color: colors.error },
});
