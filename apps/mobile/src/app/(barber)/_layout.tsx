import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (name: TabIconName) =>
  function Icon({ color, size }: { color: ColorValue; size: number }): React.ReactElement {
    return <Ionicons color={color} name={name} size={size} />;
  };

export default function BarberLayout(): React.ReactElement {
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
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: tabIcon('today') }} />
      <Tabs.Screen
        name="appointments"
        options={{ title: 'Appointments', tabBarIcon: tabIcon('calendar-outline') }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Calendar', tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="business"
        options={{ title: 'Business', tabBarIcon: tabIcon('briefcase') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('storefront') }}
      />
      <Tabs.Screen name="setup" options={{ href: null }} />
    </Tabs>
  );
}
