import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';

import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { colors, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export const Screen = ({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
}: ScreenProps): React.ReactElement => {
  if (!scroll) {
    return (
      <View style={styles.container}>
        <NetworkBanner />
        <View style={styles.content}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NetworkBanner />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh === undefined ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          )
        }
      >
        {children}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  scroll: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
