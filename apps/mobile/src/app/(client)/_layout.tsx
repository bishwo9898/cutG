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
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopColor: colors.border,
          height: 72,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: tabIcon('search') }} />
      <Tabs.Screen
        name="appointments"
        options={{ title: 'Appointments', tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: tabIcon('heart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person') }} />
      <Tabs.Screen name="design" options={{ href: null }} />
    </Tabs>
  );
}
