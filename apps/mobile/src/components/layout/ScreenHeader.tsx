import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
};

export const ScreenHeader = ({
  title,
  subtitle,
  showBack = false,
}: ScreenHeaderProps): React.ReactElement => (
  <View style={styles.wrap}>
    {showBack ? (
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Ionicons color={colors.textPrimary} name="chevron-back" size={22} />
      </Pressable>
    ) : null}
    <View style={styles.textWrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle !== undefined ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  </View>
);

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  wrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
