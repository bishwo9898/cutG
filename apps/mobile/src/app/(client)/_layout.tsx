import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/theme';

type TabIconName = keyof typeof Ionicons.glyphMap;

const tabIcon = (name: TabIconName) =>
  function Icon({ color, size }: { color: string; size: number }): React.ReactElement {
    return <Ionicons color={color} name={name} size={size} />;
  };

export default function ClientLayout(): React.ReactElement {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentLight,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.primary, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: tabIcon('search') }} />
      <Tabs.Screen
        name="appointments"
        options={{ title: 'Appointments', tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: tabIcon('heart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person') }} />
    </Tabs>
  );
}
