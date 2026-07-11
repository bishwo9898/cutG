import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export const openNavigation = async (
  latitude: number,
  longitude: number,
  label = 'Client address',
): Promise<void> => {
  const encodedLabel = encodeURIComponent(label);
  const nativeUrl =
    Platform.OS === 'ios'
      ? `maps://?daddr=${latitude},${longitude}&q=${encodedLabel}`
      : `google.navigation:q=${latitude},${longitude}`;
  const fallback = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const supported = await Linking.canOpenURL(nativeUrl);
  await Linking.openURL(supported ? nativeUrl : fallback);
};
