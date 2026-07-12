import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { useBarberProfile } from '@/hooks/useBarbers';
import { colors, spacing, typography } from '@/theme';

export default function SelectAppointmentTypeScreen(): React.ReactElement {
  const { barberId = '', serviceId = '' } = useLocalSearchParams<{
    barberId?: string;
    serviceId?: string;
  }>();
  const profile = useBarberProfile(barberId);
  const mobile = profile.data?.mobileService;

  const continueTo = (type: 'shop' | 'mobile'): void => {
    const route = type === 'mobile' ? 'address' : 'slot';
    router.push(
      `/(client)/discover/${barberId}/book/${route}?serviceId=${serviceId}&appointmentType=${type}`,
    );
  };

  return (
    <Screen>
      <ScreenHeader
        showBack
        title="How would you like your appointment?"
        subtitle="Choose the location before selecting a time."
      />
      <Pressable onPress={() => continueTo('shop')}>
        <Card style={styles.option}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>S</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.title}>At the shop</Text>
            <Text style={styles.meta}>
              {[profile.data?.address, profile.data?.city, profile.data?.state]
                .filter(Boolean)
                .join(', ') || 'Barber location'}
            </Text>
            <Text style={styles.free}>No travel fee</Text>
          </View>
        </Card>
      </Pressable>
      {mobile?.isEnabled === true ? (
        <Pressable onPress={() => continueTo('mobile')}>
          <Card style={styles.option}>
            <View style={[styles.icon, styles.mobileIcon]}>
              <Text style={styles.iconText}>M</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>Mobile - come to me</Text>
              <Text style={styles.meta}>Your barber travels to your address.</Text>
              <Text style={styles.free}>
                {mobile.travelFeeStructure === 'flat'
                  ? `Travel fee about $${mobile.baseFee.toFixed(2)}`
                  : 'Travel fee calculated from distance'}
              </Text>
            </View>
          </Card>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  free: { ...typography.caption, color: colors.success, marginTop: spacing.sm },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconText: { ...typography.button, color: colors.textPrimary },
  meta: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs },
  mobileIcon: { backgroundColor: colors.surfaceRaised },
  option: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary },
});
