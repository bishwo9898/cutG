import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export const Divider = (): React.ReactElement => <View style={styles.divider} />;

const styles = StyleSheet.create({
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
  },
});
