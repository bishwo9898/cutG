import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (name: TabIconName) =>
  function Icon({ color, size }: { color: string; size: number }): React.ReactElement {
    return <Ionicons color={color} name={name} size={size} />;
  };

export default function BarberLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentLight,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.primary, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: tabIcon('today') }} />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Calendar', tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="appointments"
        options={{ title: 'Clients', tabBarIcon: tabIcon('people') }}
      />
      <Tabs.Screen
        name="business"
        options={{ title: 'Business', tabBarIcon: tabIcon('briefcase') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('storefront') }}
      />
    </Tabs>
  );
}
