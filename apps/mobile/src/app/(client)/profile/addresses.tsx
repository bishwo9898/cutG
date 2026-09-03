import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import type { SelectedPlace } from '@/components/ui/PlacesAutocomplete';
import { PreciseLocationMap } from '@/components/ui/PreciseLocationMap';
import {
  useClientAddresses,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
} from '@/hooks/useMobileBarber';
import { errorMessage } from '@/lib/errors';
import { colors, spacing, typography } from '@/theme';

export default function ClientAddressesScreen(): React.ReactElement {
  const addresses = useClientAddresses();
  const create = useCreateAddress();
  const remove = useDeleteAddress();
  const setDefault = useSetDefaultAddress();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('Home');
  const [place, setPlace] = useState<SelectedPlace | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    if (place === null) return;
    try {
      await create.mutateAsync({
        label,
        addressLine1: place.addressLine1,
        addressLine2: place.addressLine2,
        city: place.city,
        state: place.state,
        zipCode: place.zipCode,
        country: 'US',
        latitude: place.latitude,
        longitude: place.longitude,
      });
      setAdding(false);
      setPlace(null);
      setMessage('Address saved.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  return (
    <Screen>
      <ScreenHeader showBack title="Saved addresses" subtitle="Manage places for mobile visits." />
      {(addresses.data?.addresses ?? []).map((address) => (
        <Card key={address.id}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{address.label}</Text>
                {address.isDefault ? <Badge icon="star" label="Default" tone="default" /> : null}
              </View>
              <Text style={styles.meta}>{address.addressLine1}</Text>
              {address.addressLine2 !== null && address.addressLine2 !== undefined ? (
                <Text style={styles.meta}>{address.addressLine2}</Text>
              ) : null}
              <Text style={styles.meta}>
                {address.city}, {address.state} {address.zipCode}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Delete address"
              onPress={() => void remove.mutateAsync(address.id)}
              style={styles.iconButton}
            >
              <Ionicons color={colors.error} name="trash-outline" size={21} />
            </Pressable>
          </View>
          {!address.isDefault ? (
            <Button
              title="Set as default"
              variant="ghost"
              onPress={() => void setDefault.mutateAsync(address.id)}
            />
          ) : null}
        </Card>
      ))}
      {adding ? (
        <Card>
          <Input label="Label" value={label} onChangeText={setLabel} placeholder="Home" />
          <PlacesAutocomplete onSelect={setPlace} />
          {place !== null ? <PreciseLocationMap place={place} onChange={setPlace} /> : null}
          <Button
            disabled={place === null || create.isPending}
            title="Save address"
            onPress={() => void save()}
          />
          <Button variant="ghost" title="Cancel" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button
          icon={<Ionicons color={colors.textPrimary} name="add" size={21} />}
          title="Add address"
          onPress={() => setAdding(true)}
        />
      )}
      {message !== null ? <Text style={styles.meta}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  meta: { ...typography.bodySmall, color: colors.textSecondary },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
});
