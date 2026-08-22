import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';

export default function RoleEntryScreen(): React.ReactElement {
  const params = useLocalSearchParams<{ role?: string }>();
  const role = params.role === 'BARBER' ? 'BARBER' : 'CLIENT';
  const isBarber = role === 'BARBER';
  return (
    <Screen scroll={false}>
      <ScreenHeader
        showBack
        title={isBarber ? 'Build your business' : 'Find your barber'}
        subtitle={
          isBarber
            ? 'Manage bookings, services, and mobile visits from one workspace.'
            : 'Save favorites, book confidently, and follow mobile visits live.'
        }
      />
      <Card style={styles.preview}>
        <View style={styles.icon}>
          <Ionicons
            color={colors.textPrimary}
            name={isBarber ? 'cut-outline' : 'location-outline'}
            size={30}
          />
        </View>
        <Text style={styles.title}>
          {isBarber ? 'Your chair, organized.' : 'A better booking experience.'}
        </Text>
        <Text style={styles.copy}>
          {isBarber
            ? 'Review requests, update availability, take payments, and share your journey when you travel.'
            : 'Search nearby professionals, compare real availability, and keep every appointment in one place.'}
        </Text>
      </Card>
      <View style={styles.actions}>
        <Button
          title="Create account"
          onPress={() => router.push(`/(auth)/register?role=${role}`)}
        />
        <Button
          title="Sign in"
          variant="secondary"
          onPress={() => router.push(`/(auth)/login?role=${role}`)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: 'auto' },
  copy: { ...typography.body, color: colors.textSecondary, lineHeight: 24 },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.statusInProgressSurface,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  preview: { gap: spacing.md, marginTop: spacing.xl, padding: spacing.lg },
  title: { ...typography.h2, color: colors.textPrimary },
});
