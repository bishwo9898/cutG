import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (name: TabIconName) =>
  function Icon({ color, size }: { color: ColorValue; size: number }): React.ReactElement {
    return <Ionicons color={color} name={name} size={size} />;
  };

export default function ClientLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Tab tints colour the label as well as the icon, so these use the text-safe tones:
        // the decorative gold reads at 2.9:1 and textMuted at 2.7:1 against the bar.
        tabBarActiveTintColor: colors.goldText,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 76,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: tabIcon('search') }} />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appointments',
          tabBarIcon: tabIcon('calendar'),
          // A booking detail is pushed into this tab from elsewhere (the barber's Today list,
          // the customer's booking confirmation). Without this the tab keeps that detail as its
          // top screen for the rest of the session, so tapping Appointments never reaches the
          // list again — there is no way back to it but the hardware back button.
          popToTopOnBlur: true,
        }}
      />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: tabIcon('heart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person') }} />
      <Tabs.Screen name="design" options={{ href: null }} />
    </Tabs>
  );
}
