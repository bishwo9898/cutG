import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import { colors, spacing, typography } from '@/theme';

export type SelectedPlace = {
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

type Suggestion = { description: string; place_id: string };
type AddressComponent = { long_name: string; short_name: string; types: string[] };

type PlacesAutocompleteProps = {
  onSelect: (address: SelectedPlace) => void;
  placeholder?: string;
  initialValue?: string;
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
}: PlacesAutocompleteProps): React.ReactElement => {
  const [value, setValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (apiKey.length === 0 || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      const load = async (): Promise<void> => {
        setLoading(true);
        try {
          const params = new URLSearchParams({
            input: value.trim(),
            types: 'address',
            components: 'country:us',
            key: apiKey,
          });
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
          );
          const body = (await response.json()) as { predictions?: Suggestion[] };
          setSuggestions(body.predictions ?? []);
        } finally {
          setLoading(false);
        }
      };
      void load();
    }, 350);
    return (): void => clearTimeout(timer);
  }, [value]);

  const select = async (suggestion: Suggestion): Promise<void> => {
    const params = new URLSearchParams({
      place_id: suggestion.place_id,
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
        label="Address"
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        helperText={
          apiKey.length === 0
            ? 'Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to enable suggestions.'
            : loading
              ? 'Finding addresses...'
              : undefined
        }
      />
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion.place_id}
          onPress={() => void select(suggestion)}
          style={styles.suggestion}
        >
          <Ionicons color={colors.info} name="location-outline" size={18} />
          <Text style={styles.suggestionText}>{suggestion.description}</Text>
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
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
