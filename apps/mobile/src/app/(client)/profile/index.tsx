import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/authStore';
import { unregisterCurrentDevice } from '@/services/pushNotifications';
import { colors, typography } from '@/theme';

export default function ClientProfileScreen(): React.ReactElement {
  const { user, clearAuth, updateUser } = useAuthStore();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [message, setMessage] = useState<string | null>(null);

  const save = async (): Promise<void> => {
    try {
      const updated = await mobileApi.auth.updateMe({
        firstName,
        lastName,
        phone: phone.length > 0 ? phone : null,
      });
      await updateUser(updated);
      setMessage('Profile updated.');
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const logout = async (): Promise<void> => {
    await unregisterCurrentDevice();
    await mobileApi.auth.logout().catch(() => undefined);
    await clearAuth();
    router.replace('/(auth)/welcome');
  };

  return (
    <Screen>
      <ScreenHeader title="Profile" subtitle="Customer account settings." />
      <Card>
        <Avatar
          name={(user?.firstName ?? 'cutG') + ' ' + (user?.lastName ?? 'Customer')}
          size={72}
        />
        <Text style={styles.title}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.meta}>{user?.email}</Text>
      </Card>
      <Input label="First name" value={firstName} onChangeText={setFirstName} />
      <Input label="Last name" value={lastName} onChangeText={setLastName} />
      <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Button
        title="Save profile"
        onPress={() => {
          void save();
        }}
      />
      <Button
        title="Saved addresses"
        variant="secondary"
        onPress={() => router.push('/(client)/profile/addresses')}
      />
      <Button
        title="Sign out"
        variant="danger"
        onPress={() => {
          void logout();
        }}
      />
      {message !== null ? <Text style={styles.meta}>{message}</Text> : null}
      <Text style={styles.version}>cutG mobile v0.1.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
