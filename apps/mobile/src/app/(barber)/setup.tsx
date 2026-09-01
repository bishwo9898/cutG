import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { mobileApi } from '@/lib/apiClient';
import { errorMessage } from '@/lib/errors';
import { queryClient } from '@/lib/queryClient';
import { colors, spacing, typography } from '@/theme';

const SetupLink = ({
  icon,
  title,
  copy,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  onPress: () => void;
}): React.ReactElement => (
  <Card>
    <View style={styles.row}>
      <View style={styles.icon}>
        <Ionicons color={colors.textPrimary} name={icon} size={22} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{copy}</Text>
      </View>
    </View>
    <Button title="Set up" variant="secondary" onPress={onPress} />
  </Card>
);

export default function BarberSetupScreen(): React.ReactElement {
  const [created, setCreated] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const create = async (): Promise<void> => {
    setSaving(true);
    setMessage(null);
    try {
      await mobileApi.barber.createProfile({
        businessName,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['barber', 'profile'] });
      setCreated(true);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen>
      <ScreenHeader
        showNotifications
        title="Set up your workspace"
        subtitle="Complete the essentials before accepting bookings."
      />
      {!created ? (
        <>
          <Card>
            <Text style={styles.step}>STEP 1 OF 4</Text>
            <Text style={styles.title}>Business identity</Text>
            <Text style={styles.meta}>You can refine these details from your profile later.</Text>
          </Card>
          <Input label="Business name" value={businessName} onChangeText={setBusinessName} />
          <Input label="Street address (optional)" value={address} onChangeText={setAddress} />
          <View style={styles.row}>
            <View style={styles.copy}>
              <Input label="City" value={city} onChangeText={setCity} />
            </View>
            <View style={styles.copy}>
              <Input label="State" value={state} onChangeText={setState} />
            </View>
          </View>
          {message !== null ? <Text style={styles.error}>{message}</Text> : null}
          <Button
            title="Create workspace"
            loading={saving}
            disabled={businessName.trim().length === 0}
            onPress={() => void create()}
          />
        </>
      ) : (
        <>
          <Card>
            <Text style={styles.step}>WORKSPACE CREATED</Text>
            <Text style={styles.title}>Finish the booking essentials</Text>
            <Text style={styles.meta}>Work through these cards in any order.</Text>
          </Card>
          <SetupLink
            icon="location-outline"
            title="Service locations"
            copy="Confirm your precise shop address and mobile service area."
            onPress={() => router.push('/(barber)/business/mobile-service')}
          />
          <SetupLink
            icon="cut-outline"
            title="Add your first service"
            copy="Set a clear name, duration, category, and price."
            onPress={() => router.push('/(barber)/business/services')}
          />
          <SetupLink
            icon="calendar-outline"
            title="Set working hours"
            copy="Choose bookable days and block time away."
            onPress={() => router.push('/(barber)/schedule')}
          />
          <SetupLink
            icon="card-outline"
            title="Online payments"
            copy="Review payment readiness from your business workspace."
            onPress={() => router.push('/(barber)/business/payments')}
          />
          <Button title="Open Today" onPress={() => router.replace('/(barber)/today')} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1 },
  error: { ...typography.bodySmall, color: colors.error },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.statusInProgressSurface,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  meta: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  step: { ...typography.caption, color: colors.goldText, fontWeight: '800', letterSpacing: 1.2 },
  title: { ...typography.h3, color: colors.textPrimary },
});
