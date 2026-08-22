import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/layout/Screen';
import { colors, spacing, typography } from '@/theme';

export default function WelcomeScreen(): React.ReactElement {
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <View style={styles.mark}>
          <Text style={styles.markText}>G</Text>
        </View>
        <Text style={styles.logo}>cutG</Text>
        <Text style={styles.tagline}>A smoother way to book—and a sharper way to work.</Text>
        <View style={styles.promise}>
          <Ionicons color={colors.success} name="checkmark-circle" size={18} />
          <Text style={styles.promiseText}>
            Real availability · Simple payments · Live mobile visits
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button title="Find your barber" onPress={() => router.push('/(auth)/entry?role=CLIENT')} />
        <Button
          title="I'm a Barber"
          onPress={() => router.push('/(auth)/entry?role=BARBER')}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.textPrimary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 56,
  },
  markText: { color: colors.textOnAccent, fontSize: 28, fontWeight: '900' },
  logo: {
    color: colors.textPrimary,
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: 0,
  },
  tagline: {
    ...typography.h3,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  promise: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  promiseText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
});
