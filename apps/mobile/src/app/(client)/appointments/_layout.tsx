import { Stack } from 'expo-router';

/**
 * Without a layout here, expo-router hoists every nested route in this folder into the parent tab
 * navigator, so each one rendered as its own tab — the bar filled with unnamed entries and broken
 * icons, and pushing a screen swapped tabs instead of stacking. This keeps Appointments a single tab that
 * owns its own stack.
 */
export default function ClientAppointmentsLayout(): React.ReactElement {
  return <Stack screenOptions={{ headerShown: false }} />;
}
