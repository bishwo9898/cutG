import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/layout/Screen';
import { colors, spacing, typography } from '@/theme';

export default function WelcomeScreen(): React.ReactElement {
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Text style={styles.logo}>cutG</Text>
        <Text style={styles.tagline}>Book sharp. Run sharper.</Text>
      </View>
      <View style={styles.actions}>
        <Button title="Find a Barber" onPress={() => router.push('/(auth)/login?role=CLIENT')} />
        <Button
          title="I'm a Barber"
          onPress={() => router.push('/(auth)/login?role=BARBER')}
          variant="secondary"
        />
        <Button
          title="Create an account"
          onPress={() => router.push('/(auth)/role-select')}
          variant="ghost"
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
  logo: {
    color: colors.textPrimary,
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: 0,
  },
  tagline: {
    ...typography.h2,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
