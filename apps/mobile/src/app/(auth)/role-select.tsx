import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/theme';

type RoleCardProps = {
  title: string;
  description: string;
  role: 'CLIENT' | 'BARBER';
};

const RoleCard = ({ title, description, role }: RoleCardProps): React.ReactElement => (
  <Pressable onPress={() => router.push('/(auth)/register?role=' + role)}>
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </Card>
  </Pressable>
);

export default function RoleSelectScreen(): React.ReactElement {
  return (
    <Screen>
      <ScreenHeader
        showBack
        title="Choose your side"
        subtitle="cutG is built for clients and barbers."
      />
      <View style={styles.cards}>
        <RoleCard
          description="Search, save, book, pay, cancel, and review barbers from your phone."
          role="CLIENT"
          title="I'm looking for a barber"
        />
        <RoleCard
          description="Run your schedule, services, appointments, earnings, and subscription."
          role="BARBER"
          title="I'm a barber"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});
