import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export const openNavigation = async (
  latitude: number,
  longitude: number,
  label = 'Customer address',
): Promise<void> => {
  const encodedLabel = encodeURIComponent(label);
  const nativeUrl =
    Platform.OS === 'ios'
      ? `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving&q=${encodedLabel}`
      : `google.navigation:q=${latitude},${longitude}&mode=d`;
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving&dir_action=navigate`;
  const supported = await Linking.canOpenURL(nativeUrl);
  await Linking.openURL(supported ? nativeUrl : fallback);
};
