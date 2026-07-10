import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import type { ServiceCategory } from '@/lib/types';
import { errorMessage } from '@/lib/errors';
import { colors, typography } from '@/theme';

const serviceCategories: ServiceCategory[] = [
  'haircut',
  'beard',
  'shave',
  'combo',
  'kids',
  'other',
];
const serviceDurations = [15, 30, 45, 60, 90, 120] as const;

const parseCategory = (value: string): ServiceCategory =>
  serviceCategories.includes(value as ServiceCategory) ? (value as ServiceCategory) : 'haircut';

const parseDuration = (value: string): (typeof serviceDurations)[number] => {
  const parsed = Number(value);
  return serviceDurations.includes(parsed as (typeof serviceDurations)[number])
    ? (parsed as (typeof serviceDurations)[number])
    : 30;
};

export default function EditServiceScreen(): React.ReactElement {
  const { serviceId = 'new' } = useLocalSearchParams<{ serviceId?: string }>();
  const isNew = serviceId === 'new';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('25');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [category, setCategory] = useState('haircut');
  const [message, setMessage] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    try {
      const body = {
        category: parseCategory(category),
        description,
        durationMinutes: parseDuration(durationMinutes),
        name,
        price: Number(price),
      };
      if (isNew) {
        await mobileApi.barber.createService(body);
      } else {
        await mobileApi.barber.updateService(serviceId, body);
      }
      router.back();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const deactivate = async (): Promise<void> => {
    if (isNew) return;
    await mobileApi.barber.updateService(serviceId, { isActive: false });
    router.back();
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title={isNew ? 'Add service' : 'Edit service'}
        subtitle="Name, price, duration, and category."
      />
      <Input label="Name" value={name} onChangeText={setName} />
      <Input label="Description" value={description} onChangeText={setDescription} multiline />
      <Input label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      <Input
        label="Duration minutes"
        value={durationMinutes}
        onChangeText={setDurationMinutes}
        keyboardType="number-pad"
      />
      <Input label="Category" value={category} onChangeText={setCategory} />
      <Button
        title="Save"
        onPress={() => {
          void save();
        }}
      />
      {!isNew ? (
        <Button
          title="Deactivate"
          variant="danger"
          onPress={() => {
            void deactivate();
          }}
        />
      ) : null}
      {message !== null ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
