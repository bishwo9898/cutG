import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import { colors, spacing, typography } from '@/theme';

export type SelectedPlace = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

export type PlaceSearchSuggestion = {
  description: string;
  id: string;
  place?: SelectedPlace;
};
type AddressComponent = { long_name: string; short_name: string; types: string[] };

type PlacesAutocompleteProps = {
  onSelect: (address: SelectedPlace) => void;
  placeholder?: string;
  initialValue?: string;
  label?: string;
  loadSuggestions?: (query: string) => Promise<PlaceSearchSuggestion[]>;
  onUseManual?: (address: string) => void;
};

const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const component = (items: AddressComponent[], type: string, short = false): string => {
  const item = items.find((candidate) => candidate.types.includes(type));
  return item === undefined ? '' : short ? item.short_name : item.long_name;
};

export const PlacesAutocomplete = ({
  onSelect,
  placeholder = 'Start typing an address',
  initialValue = '',
  label = 'Address',
  loadSuggestions,
  onUseManual,
}: PlacesAutocompleteProps): React.ReactElement => {
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<PlaceSearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setValue(initialValue), [initialValue]);

  useEffect(() => {
    if (value.trim().length < 3 || (loadSuggestions === undefined && apiKey.length === 0)) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      const load = async (): Promise<void> => {
        setLoading(true);
        setMessage(null);
        try {
          if (loadSuggestions !== undefined) {
            setSuggestions(await loadSuggestions(value.trim()));
            return;
          }
          const params = new URLSearchParams({
            input: value.trim(),
            types: 'address',
            components: 'country:us',
            key: apiKey,
          });
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
          );
          const body = (await response.json()) as {
            predictions?: Array<{ description: string; place_id: string }>;
          };
          setSuggestions(
            (body.predictions ?? []).map((suggestion) => ({
              description: suggestion.description,
              id: suggestion.place_id,
            })),
          );
        } catch {
          setSuggestions([]);
          setMessage('Map suggestions are unavailable. You can still use the address as typed.');
        } finally {
          setLoading(false);
        }
      };
      void load();
    }, 350);
    return (): void => clearTimeout(timer);
  }, [loadSuggestions, value]);

  const select = async (suggestion: PlaceSearchSuggestion): Promise<void> => {
    if (suggestion.place !== undefined) {
      setValue(suggestion.place.formattedAddress);
      setSuggestions([]);
      onSelect(suggestion.place);
      return;
    }
    const params = new URLSearchParams({
      place_id: suggestion.id,
      fields: 'formatted_address,geometry,address_components',
      key: apiKey,
    });
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
    );
    const body = (await response.json()) as {
      result?: {
        formatted_address?: string;
        address_components?: AddressComponent[];
        geometry?: { location?: { lat: number; lng: number } };
      };
    };
    const result = body.result;
    const components = result?.address_components ?? [];
    const location = result?.geometry?.location;
    if (result === undefined || location === undefined) return;
    const streetNumber = component(components, 'street_number');
    const route = component(components, 'route');
    const selected = {
      addressLine1: [streetNumber, route].filter(Boolean).join(' '),
      ...(component(components, 'subpremise').length === 0
        ? {}
        : { addressLine2: component(components, 'subpremise') }),
      city: component(components, 'locality') || component(components, 'sublocality_level_1'),
      state: component(components, 'administrative_area_level_1', true),
      zipCode: component(components, 'postal_code'),
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address ?? suggestion.description,
    };
    setValue(selected.formattedAddress);
    setSuggestions([]);
    onSelect(selected);
  };

  return (
    <View style={styles.wrap}>
      <Input
        label={label}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        helperText={
          loadSuggestions === undefined && apiKey.length === 0
            ? 'Address suggestions are unavailable. You can enter the address manually.'
            : loading
              ? 'Finding addresses...'
              : undefined
        }
      />
      {suggestions.map((suggestion) => (
        <Pressable
          accessibilityRole="button"
          key={suggestion.id}
          onPress={() => void select(suggestion)}
          style={styles.suggestion}
        >
          <Ionicons color={colors.info} name="location-outline" size={18} />
          <Text style={styles.suggestionText}>{suggestion.description}</Text>
        </Pressable>
      ))}
      {value.trim().length >= 3 && onUseManual !== undefined ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setSuggestions([]);
            onUseManual(value.trim());
          }}
          style={[styles.suggestion, styles.manualSuggestion]}
        >
          <Ionicons color={colors.textSecondary} name="create-outline" size={18} />
          <View style={styles.flex}>
            <Text style={styles.suggestionText}>Use “{value.trim()}” as typed</Text>
            <Text style={styles.helper}>You can complete the details and exact pin manually.</Text>
          </View>
        </Pressable>
      ) : null}
      {message !== null ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  error: { ...typography.bodySmall, color: colors.error },
  flex: { flex: 1 },
  helper: { ...typography.caption, color: colors.textSecondary },
  manualSuggestion: { backgroundColor: colors.surfaceRaised },
  suggestion: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  suggestionText: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  wrap: { gap: spacing.xs },
});
